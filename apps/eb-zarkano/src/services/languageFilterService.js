import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { languageFilterConfig } from "../config/languageFilter.js";
import { isModerationDisabled } from "./moderationState.js";

const userStates = new Map();
const leetspeakMap = Object.freeze({
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
});

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
  const mapped = [...content.toLowerCase()]
    .map((character) => leetspeakMap[character] ?? character)
    .join("");

  return mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(content) {
  return normalizeText(content).replace(/\s/g, "");
}

function findTermMatches(normalized, compact) {
  const matches = [];

  for (const term of languageFilterConfig.terms) {
    for (const expression of term.expressions) {
      const normalizedExpression = normalizeText(expression);
      const compactExpression = normalizedExpression.replace(/\s/g, "");
      const directMatch = normalized.includes(normalizedExpression);
      const compactMatch =
        compactExpression.length >= 3 && compact.includes(compactExpression);

      if (directMatch || compactMatch) {
        matches.push({
          ...term,
          expression,
          evasion: compactMatch && !directMatch,
        });
      }
    }
  }

  return matches;
}

function pruneState(state, now) {
  state.messages = state.messages.slice(
    -languageFilterConfig.maxTrackedMessagesPerUser,
  );

  if (
    state.lastInfractionAt > 0 &&
    now - state.lastInfractionAt > languageFilterConfig.historyWindowMs
  ) {
    state.infractions = Math.max(0, state.infractions - 1);
    state.lastInfractionAt = state.infractions > 0 ? now : 0;
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

function analyzeMessage(message, state, now) {
  const normalized = normalizeText(message.content);
  const compact = normalized.replace(/\s/g, "");
  const matches = findTermMatches(normalized, compact);
  const recentRepeat = state.messages.some(
    (entry) =>
      now - entry.timestamp <= 30_000 &&
      entry.compactContent === compact &&
      compact.length > 0,
  );
  const directedAtSomeone =
    message.mentions.users.size > 0 ||
    /\b(voce|vc|tu|seu|sua)\b/.test(normalized);
  const evasions = matches.filter((match) => match.evasion).length;
  const hasDirectedInsult =
    directedAtSomeone && matches.some((match) => match.level <= 2);
  const historyPoints = Math.min(state.infractions * 5, 15);
  const riskScore = Math.min(
    120,
    matches.reduce((total, match) => total + match.score, 0) +
      evasions * 20 +
      (hasDirectedInsult ? 25 : 0) +
      (recentRepeat ? 10 : 0) +
      historyPoints,
  );
  const categories = [...new Set(matches.map((match) => match.category))];

  return {
    normalized,
    compact,
    matches,
    categories,
    riskScore,
    recentRepeat,
    hasDirectedInsult,
    shouldLog: matches.length > 0,
    shouldDelete: riskScore >= languageFilterConfig.deletionRiskScore,
    shouldWarn: riskScore >= languageFilterConfig.warningRiskScore,
    isCritical: riskScore >= languageFilterConfig.criticalRiskScore,
  };
}

async function sendPrivateWarning(message, state, deleted) {
  const now = Date.now();

  if (
    !deleted ||
    !message.author ||
    now - state.lastWarningAt < languageFilterConfig.warningCooldownMs
  ) {
    return false;
  }

  state.lastWarningAt = now;

  try {
    await message.author.send(
      [
        "⚠️ Sua mensagem foi removida automaticamente.",
        "",
        "O conteúdo enviado violou as regras de linguagem do servidor.",
        "Evite repetir esse comportamento para não receber uma punição.",
        "",
        "Sistema de Filtro de Linguagem — EB Zarkano",
      ].join("\n"),
    );
    return true;
  } catch {
    return false;
  }
}

async function sendLanguageLog(
  message,
  analysis,
  deleted,
  warningSent,
  state,
) {
  const logsChannelId = getConfiguredChannelId("logs");

  if (!logsChannelId) {
    return;
  }

  try {
    const logsChannel = await message.client.channels.fetch(logsChannelId);

    if (!logsChannel || typeof logsChannel.send !== "function") {
      return;
    }

    const matchedTerms = [
      ...new Set(analysis.matches.map((match) => match.expression)),
    ].join(", ");
    const originalContent =
      message.content.length > 900
        ? `${message.content.slice(0, 897)}...`
        : message.content;

    const embed = new EmbedBuilder()
      .setColor(analysis.isCritical ? 0x992d22 : 0xe67e22)
      .setTitle("🛡️ Filtro de Linguagem")
      .addFields(
        { name: "Usuário", value: `${message.author} (${message.author.tag})` },
        { name: "ID do usuário", value: message.author.id, inline: true },
        { name: "Canal", value: `<#${message.channel.id}>`, inline: true },
        { name: "Risk score", value: String(analysis.riskScore), inline: true },
        {
          name: "Categorias",
          value: analysis.categories.join(", ") || "Não identificada",
        },
        { name: "Termos/padrões", value: matchedTerms || "Padrão comportamental" },
        { name: "Mensagem removida", value: deleted ? "Sim" : "Não", inline: true },
        { name: "Aviso enviado", value: warningSent ? "Sim" : "Não", inline: true },
        {
          name: "Infrações anteriores",
          value: String(Math.max(0, state.infractions - 1)),
          inline: true,
        },
        { name: "Conteúdo", value: originalContent || "[vazio]" },
      )
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Não foi possível registrar o filtro de linguagem:", error);
  }
}

export async function handleLanguageFilterMessage(message) {
  if (
    !languageFilterConfig.enabled ||
    shouldIgnoreMessage(message) ||
    (await isModerationDisabled(message.channel.id))
  ) {
    return false;
  }

  const now = Date.now();
  const state = getUserState(message);
  pruneState(state, now);
  const analysis = analyzeMessage(message, state, now);

  state.messages.push({
    timestamp: now,
    compactContent: analysis.compact,
  });

  if (!analysis.shouldLog) {
    return false;
  }

  state.infractions += 1;
  state.lastInfractionAt = now;
  let deleted = false;

  if (analysis.shouldDelete && message.deletable) {
    try {
      await message.delete();
      deleted = true;
    } catch (error) {
      console.error("Não foi possível apagar mensagem inadequada:", error);
    }
  }

  const warningSent = await sendPrivateWarning(message, state, deleted);
  await sendLanguageLog(message, analysis, deleted, warningSent, state);
  return deleted;
}