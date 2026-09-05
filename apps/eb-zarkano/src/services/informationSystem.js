import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { serverRules, generalProvisions } from "../content/serverRules.js";
import { getConfiguredChannelId } from "../config/channels.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const INFORMATION_PANEL_FOOTER = "EB Zarkano • Painel de informações";

function getChannelMention(channelKey, fallback) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId ? `<#${channelId}>` : fallback;
}

function getChannelUrl(guildId, channelKey) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId
    ? `https://discord.com/channels/${guildId}/${channelId}`
    : null;
}

function createNavigationButtons(guildId) {
  const buttons = [
    {
      channelKey: "informacoes",
      label: "Regras",
      emoji: "📜",
    },
    {
      channelKey: "recrutamento",
      label: "Recrutamento",
      emoji: "🪖",
    },
    {
      channelKey: "tickets",
      label: "Atendimento",
      emoji: "🎫",
    },
  ]
    .map(({ channelKey, label, emoji }) => {
      const url = getChannelUrl(guildId, channelKey);

      if (!url) {
        return null;
      }

      return new ButtonBuilder()
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Link)
        .setURL(url);
    })
    .filter(Boolean);

  return buttons.length > 0
    ? [new ActionRowBuilder().addComponents(...buttons)]
    : [];
}

function createInformationPanelPayload(guild) {
  const recruitmentChannel = getChannelMention(
    "recrutamento",
    "o canal de recrutamento",
  );
  const ticketsChannel = getChannelMention(
    "tickets",
    "o canal de atendimento",
  );

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("⚖️ Exército Brasileiro — Informações")
    .setDescription(
      [
        "A seguir você encontrará as informações necessárias para sua permanência no Exército Brasileiro.",
        "",
        "Leia atentamente e mantenha-se sempre comprometido com os valores da instituição.",
        "",
        `Para fazer parte do EB, confira ${recruitmentChannel}. Para dúvidas ou irregularidades, utilize ${ticketsChannel}.`,
      ].join("\n"),
    )
    .addFields(
      ...serverRules.map((rule) => ({
        name: `📘 ${rule.title}`,
        value: rule.body,
        inline: false,
      })),
      {
        name: "📜 Disposições Gerais",
        value: generalProvisions,
        inline: false,
      },
    )
    .setFooter({ text: INFORMATION_PANEL_FOOTER })
    .setTimestamp();

  return {
    embeds: [embed],
    components: createNavigationButtons(guild.id),
  };
}

export async function ensureInformationPanel(client) {
  const informationChannelId = getConfiguredChannelId("informacoes");

  if (!informationChannelId) {
    console.warn(
      "Canal de informações não configurado. Preencha channelIds.informacoes em src/config/channels.js.",
    );
    return { created: false, reason: "missing-channel" };
  }

  const informationChannel = await client.channels.fetch(informationChannelId);

  if (!informationChannel || typeof informationChannel.send !== "function") {
    throw new Error(
      "O canal de informações configurado não é um canal de texto válido.",
    );
  }

  const messages = await informationChannel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some(
        (embed) => embed.footer?.text === INFORMATION_PANEL_FOOTER,
      ),
  );

  if (existingPanel) {
    console.info(
      `Painel de informações encontrado em #${informationChannel.name}.`,
    );
    return { created: false, message: existingPanel };
  }

  const panelMessage = await informationChannel.send(
    createInformationPanelPayload(informationChannel.guild),
  );
  console.info(
    `Painel de informações criado em #${informationChannel.name}.`,
  );
  return { created: true, message: panelMessage };
}