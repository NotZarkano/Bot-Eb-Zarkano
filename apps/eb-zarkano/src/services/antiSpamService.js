import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { antiSpamConfig } from "../config/antiSpam.js";
import {
  getModerationLogChannelId,
  isModerationIgnored,
} from "./moderationState.js";
import { recordInfraction } from "./moderationHistory.js";
import { applyProgressiveTimeout } from "./moderationActions.js";

const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const repeatedCharacterPattern = /([^\s])\1{7,}/u;
const userStates = new Map();

function getStateKey(message) {
  return `${message.guild.id}:${message.author.id}`;
}

function getUserState(message) {
  const key = getStateKey(message);
  const existingState = userStates.get(key);

  if (existingState) {
    return existingState;
  }

  const state = {
    messages: [],
    infractions: 0,
    lastInfractionAt: 0,
    lastWarningAt: 0,
  };

  userStates.set(key, state);
  return state;
}

function normalizeText(content) {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(URL_PATTERN, "<url>")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/[^\p{L}\p{N}<>\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value) {
  return new Set(value.split(" ").filter(Boolean));
}

function calculateSimilarity(first, second) {
  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const firstTokens = getTokens(first);
  const secondTokens = getTokens(second);
  const union = new Set([...firstTokens, ...secondTokens]);

  if (union.size === 0) {
    return 0;
  }

  const intersection = [...firstTokens].filter((token) =>
    secondTokens.has(token),
  );

  return intersection.length / union.size;
}

function getUrls(content) {
  return content.match(URL_PATTERN) ?? [];
}

function getUnknownDomains(urls) {
  return urls.filter((url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return !antiSpamConfig.allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return true;
    }
  });
}

function pruneState(state, now) {
  state.messages = state.messages
    .filter(
      (entry) => now - entry.timestamp <= antiSpamConfig.contentWindowMs,
    )
    .slice(-antiSpamConfig.maxTrackedMessagesPerUser);

  if (
    state.lastInfractionAt > 0 &&
    now - state.lastInfractionAt > antiSpamConfig.historyWindowMs
  ) {
    state.infractions = Math.max(0, state.infractions - 1);
    state.lastInfractionAt = now;
  }
}

function analyzeMessage(message, state, now) {
  const normalizedContent = normalizeText(message.content);
  const recentMessages = state.messages.filter(
    (entry) => now - entry.timestamp <= antiSpamConfig.contentWindowMs,
  );
  const rapidMessages = recentMessages.filter(
    (entry) => now - entry.timestamp <= antiSpamConfig.analysisWindowMs,
  );
  const exactMatches = recentMessages.filter(
    (entry) => entry.normalizedContent === normalizedContent,
  );
  const similarMatches = recentMessages.filter(
    (entry) =>
      calculateSimilarity(entry.normalizedContent, normalizedContent) >=
      antiSpamConfig.similarMessageThreshold,
  );
  const urls = getUrls(message.content);
  const unknownDomains = getUnknownDomains(urls);
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  const hasMassMention = /@(everyone|here)\b/i.test(message.content);
  const hasRepeatedCharacters = repeatedCharacterPattern.test(message.content);
  const isVeryLong = message.content.length >= 600;
  const signals = [];
  let riskScore = 0;

  if (rapidMessages.length + 1 >= antiSpamConfig.rapidMessageThreshold) {
    const points = rapidMessages.length >= 7 ? 3 : 2;
    riskScore += points;
    signals.push(`frequência alta (+${points})`);
  }

  if (exactMatches.length >= antiSpamConfig.repeatedMessageThreshold) {
    const points = exactMatches.length >= 2 ? 4 : 3;
    riskScore += points;
    signals.push(`mensagem repetida ${exactMatches.length + 1}x (+${points})`);
  } else if (similarMatches.length > 0) {
    const points = similarMatches.length >= 2 ? 3 : 2;
    riskScore += points;
    signals.push(`mensagens semelhantes (+${points})`);
  }

  if (urls.length >= 2) {
    const points = urls.length >= 4 ? 3 : 2;
    riskScore += points;
    signals.push(`${urls.length} links na mensagem (+${points})`);
  }

  if (unknownDomains.length > 0) {
    riskScore += Math.min(2, unknownDomains.length);
    signals.push(`${unknownDomains.length} domínio(s) não permitido(s)`);
  }

  if (hasMassMention) {
    riskScore += 4;
    signals.push("@everyone/@here (+4)");
  } else if (mentionCount >= 5) {
    riskScore += 3;
    signals.push(`${mentionCount} menções (+3)`);
  } else if (mentionCount >= 3) {
    riskScore += 2;
    signals.push(`${mentionCount} menções (+2)`);
  }

  if (hasRepeatedCharacters) {
    riskScore += 2;
    signals.push("caracteres repetidos (+2)");
  }

  if (isVeryLong) {
    riskScore += 1;
    signals.push("mensagem muito longa (+1)");
  }

  if (
    state.lastInfractionAt > 0 &&
    now - state.lastInfractionAt <= antiSpamConfig.historyWindowMs
  ) {
    const points = Math.min(state.infractions, 2);
    riskScore += points;

    if (points > 0) {
      signals.push(`histórico recente (+${points})`);
    }
  }

  return {
    normalizedContent,
    riskScore,
    signals,
    exactMatches,
    shouldWarn: riskScore >= antiSpamConfig.warningRiskScore,
    shouldDelete: riskScore >= antiSpamConfig.deletionRiskScore,
  };
}

async function deleteSpamMessages(message, analysis) {
  const candidates = [
    message,
    ...analysis.exactMatches.map((entry) => entry.message),
  ];
  const uniqueCandidates = [
    ...new Map(candidates.map((candidate) => [candidate.id, candidate])).values(),
  ].slice(0, antiSpamConfig.maxMessagesDeletedPerEvent);
  let deletedCount = 0;

  for (const candidate of uniqueCandidates) {
    if (!candidate?.deletable) {
      continue;
    }

    try {
      await candidate.delete();
      deletedCount += 1;
    } catch (error) {
      console.error("Não foi possível apagar uma mensagem de spam:", error);
    }
  }

  return deletedCount;
}

async function sendPrivateWarning(message, state) {
  const now = Date.now();

  if (now - state.lastWarningAt < antiSpamConfig.warningCooldownMs) {
    return false;
  }

  state.lastWarningAt = now;

  try {
    await message.author.send(
      [
        "⚠️ Pare de enviar mensagens repetidamente!",
        "",
        "Você está enviando mensagens em uma frequência muito alta ou repetindo conteúdo.",
        "Continue realizando spam e você poderá receber uma punição automática.",
        "",
        "Sistema Anti-Spam — EB Zarkano",
      ].join("\n"),
    );
    return true;
  } catch {
    return false;
  }
}

async function sendAntiSpamLog(
  message,
  analysis,
  deletedCount,
  warningSent,
  timeoutApplied,
) {
  const logsChannelId = await getModerationLogChannelId();

  if (!logsChannelId) {
    return;
  }

  try {
    const logsChannel = await message.client.channels.fetch(logsChannelId);

    if (!logsChannel || typeof logsChannel.send !== "function") {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(analysis.shouldDelete ? 0xe74c3c : 0xf2c94c)
      .setTitle("🛡️ Detecção de Anti-Spam")
      .addFields(
        { name: "Usuário", value: `${message.author} (${message.author.tag})` },
        { name: "Canal", value: `<#${message.channel.id}>` },
        { name: "Risk score", value: String(analysis.riskScore), inline: true },
        { name: "Mensagens apagadas", value: String(deletedCount), inline: true },
        { name: "Aviso enviado", value: warningSent ? "Sim" : "Não", inline: true },
        { name: "Timeout aplicado", value: timeoutApplied ? "Sim" : "Não", inline: true },
        {
          name: "Indicadores",
          value: analysis.signals.join("\n") || "Nenhum indicador informado",
        },
      )
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Não foi possível registrar o Anti-Spam nos logs:", error);
  }
}

function shouldIgnoreMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) {
    return true;
  }

  if (!message.content?.trim()) {
    return true;
  }

  const permissions = message.member?.permissions;

  return Boolean(
    permissions?.has(PermissionFlagsBits.Administrator) ||
      permissions?.has(PermissionFlagsBits.ManageMessages),
  );
}

export async function handleAntiSpamMessage(message) {
  if (
    !antiSpamConfig.enabled ||
    shouldIgnoreMessage(message) ||
    (await isModerationIgnored(message))
  ) {
    return;
  }

  const now = Date.now();
  const state = getUserState(message);
  pruneState(state, now);
  const analysis = analyzeMessage(message, state, now);

  state.messages.push({
    message,
    messageId: message.id,
    channelId: message.channel.id,
    timestamp: now,
    normalizedContent: analysis.normalizedContent,
  });

  if (!analysis.shouldWarn) {
    return;
  }

  state.infractions += 1;
  state.lastInfractionAt = now;
  const deletedCount = analysis.shouldDelete
    ? await deleteSpamMessages(message, analysis)
    : 0;
  const warningSent = await sendPrivateWarning(message, state);
  const history = await recordInfraction({
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id,
    category: "Anti-Spam",
    score: analysis.riskScore,
    action: deletedCount > 0 ? "mensagem removida" : "aviso",
  });
  const timeoutApplied = await applyProgressiveTimeout(
    message,
    history.occurrence,
    "Reincidência em comportamento de spam.",
  );

  await sendAntiSpamLog(
    message,
    analysis,
    deletedCount,
    warningSent,
    timeoutApplied,
  );
}