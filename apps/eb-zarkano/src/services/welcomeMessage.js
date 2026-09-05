import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getConfiguredChannelId } from "../config/channels.js";

const WELCOME_BANNER_NAME = "welcome-banner.png";
const WELCOME_BANNER_PATH = fileURLToPath(
  new URL(`../../assets/${WELCOME_BANNER_NAME}`, import.meta.url),
);
const EB_ZARKANO_GREEN = 0x8fc63f;

export const welcomeButtonIds = Object.freeze({
  information: "welcome:information",
  recruitment: "welcome:recruitment",
  support: "welcome:support",
  play: "welcome:play",
});

function getChannelMention(channelKey, fallback) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId ? `<#${channelId}>` : fallback;
}

function getMemberDisplayName(member) {
  return (
    member.user.globalName ||
    member.user.username ||
    member.displayName ||
    "novo membro"
  );
}

function createWelcomeButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(welcomeButtonIds.information)
      .setLabel("Informações")
      .setEmoji("📚")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(welcomeButtonIds.recruitment)
      .setLabel("Recrutamento")
      .setEmoji("🪖")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(welcomeButtonIds.support)
      .setLabel("Suporte")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(welcomeButtonIds.play)
      .setLabel("Jogar agora")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Primary),
  );
}

function createWelcomePayload(member) {
  const informationChannel = getChannelMention(
    "informacoes",
    "o canal de informações",
  );
  const recruitmentChannel = getChannelMention(
    "recrutamento",
    "o canal de recrutamento",
  );
  const ticketsChannel = getChannelMention(
    "tickets",
    "o canal de atendimento",
  );
  const memberName = getMemberDisplayName(member);

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle(`👋 Bem-vindo(a), ${memberName}!`)
    .setDescription(
      [
        `Olá, ${member}! Você acaba de entrar para a comunidade do **Exército Brasileiro — EB Zarkano**.`,
        "",
        "Confira os canais abaixo para começar sua jornada com honra, disciplina e união.",
      ].join("\n"),
    )
    .setThumbnail(member.displayAvatarURL({ extension: "png", size: 256 }))
    .setImage(`attachment://${WELCOME_BANNER_NAME}`)
    .addFields(
      {
        name: "🛠️ Suporte",
        value: `Precisa de ajuda? Nossa equipe está pronta para orientar você. Acesse ${ticketsChannel} e solicite suporte.`,
        inline: true,
      },
      {
        name: "📚 Conheça o EB Zarkano",
        value: `Leia as regras, conheça nossa hierarquia e confira as informações úteis em ${informationChannel}.`,
        inline: true,
      },
      {
        name: "🪖 Faça parte do EB",
        value: `Quer entrar para o EB? Confira o processo de recrutamento e faça seu alistamento em ${recruitmentChannel}.`,
        inline: true,
      },
      {
        name: "🎫 Atendimento",
        value: `Para dúvidas, solicitações ou problemas, utilize nosso sistema de atendimento em ${ticketsChannel}.`,
        inline: true,
      },
    )
    .setFooter({ text: "EB Zarkano • Honra • Disciplina • União" })
    .setTimestamp();

  const banner = new AttachmentBuilder(WELCOME_BANNER_PATH, {
    name: WELCOME_BANNER_NAME,
  });

  return {
    embeds: [embed],
    files: [banner],
    components: [createWelcomeButtons()],
  };
}

export async function sendWelcomeMessage({ guild, member }) {
  const welcomeChannelId = getConfiguredChannelId("boasVindas");

  if (!welcomeChannelId) {
    return {
      sent: false,
      reason:
        "O canal de boas-vindas ainda não foi configurado em src/config/channels.js.",
    };
  }

  if (!existsSync(WELCOME_BANNER_PATH)) {
    return {
      sent: false,
      reason: `O banner obrigatório não foi encontrado em ${WELCOME_BANNER_PATH}.`,
    };
  }

  const welcomeChannel = await guild.channels.fetch(welcomeChannelId);

  if (!welcomeChannel || typeof welcomeChannel.send !== "function") {
    return {
      sent: false,
      reason:
        "O canal configurado para boas-vindas não é um canal de texto válido.",
    };
  }

  await welcomeChannel.send(createWelcomePayload(member));

  return { sent: true };
}