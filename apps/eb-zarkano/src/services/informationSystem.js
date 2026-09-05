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
export const informationButtonIds = Object.freeze({
  rules: "information:rules",
});

const informationLinks = Object.freeze({
  ebWebsite: "https://www.eb.mil.br/",
  robloxGroup: "https://www.roblox.com/communities",
  game: "https://www.roblox.com/games",
  constitution:
    "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
});

function createLinkButton(label, emoji, url) {
  return new ButtonBuilder()
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function createNavigationButtons() {
  return [
    new ActionRowBuilder().addComponents(
      createLinkButton("Site do EB", "🌐", informationLinks.ebWebsite),
    ),
    new ActionRowBuilder().addComponents(
      createLinkButton(
        "Grupo do Roblox",
        "☑️",
        informationLinks.robloxGroup,
      ),
      createLinkButton("Jogo", "🎮", informationLinks.game),
    ),
    new ActionRowBuilder().addComponents(
      createLinkButton(
        "Constituição",
        "📜",
        informationLinks.constitution,
      ),
      new ButtonBuilder()
        .setCustomId(informationButtonIds.rules)
        .setLabel("Regras")
        .setEmoji("☑️")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function createRulesEmbed() {
  return new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("📜 Regras do Exército Brasileiro")
    .addFields(
      ...serverRules.map((rule) => ({
        name: rule.title,
        value: rule.body,
        inline: false,
      })),
      {
        name: "Disposições Gerais",
        value: generalProvisions,
        inline: false,
      },
    )
    .setFooter({ text: INFORMATION_PANEL_FOOTER });
}

function createInformationPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("Exército Brasileiro - Informações")
    .setDescription(
      [
        "A seguir, você encontrará as informações necessárias para sua permanência no Exército Brasileiro.",
        "",
        "Leia atentamente e mantenha-se sempre comprometido com os valores da instituição.",
      ].join("\n"),
    )
    .setFooter({ text: INFORMATION_PANEL_FOOTER })
    .setTimestamp();

  return {
    embeds: [embed],
    components: createNavigationButtons(),
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
    await existingPanel.edit(
      createInformationPanelPayload(informationChannel.guild),
    );
    console.info(
      `Painel de informações atualizado em #${informationChannel.name}.`,
    );
    return { created: false, message: existingPanel };
  }

  const panelMessage = await informationChannel.send(
    createInformationPanelPayload(),
  );
  console.info(
    `Painel de informações criado em #${informationChannel.name}.`,
  );
  return { created: true, message: panelMessage };
}