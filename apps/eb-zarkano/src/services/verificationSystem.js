import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { getConfiguredRoleId } from "../config/roles.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const VERIFICATION_PANEL_FOOTER = "EB Zarkano • Verificação";

export const verificationButtonIds = Object.freeze({
  verify: "verification:verify",
});

function createVerificationPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("✅ Verificação — EB Zarkano")
    .setDescription(
      [
        "Para ter acesso ao restante do servidor, clique no botão abaixo e confirme sua verificação.",
        "",
        "Ao verificar, você concorda em seguir as regras do Exército Brasileiro — EB Zarkano.",
      ].join("\n"),
    )
    .setFooter({ text: VERIFICATION_PANEL_FOOTER })
    .setTimestamp();

  const verifyButton = new ButtonBuilder()
    .setCustomId(verificationButtonIds.verify)
    .setLabel("Verificar")
    .setEmoji("✅")
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(verifyButton)],
  };
}

export async function ensureVerificationPanel(client) {
  const verificationChannelId = getConfiguredChannelId("verificacao");

  if (!verificationChannelId) {
    console.warn(
      "Canal de verificação não configurado. Preencha channelIds.verificacao em src/config/channels.js.",
    );
    return { created: false, reason: "missing-channel" };
  }

  const verificationChannel = await client.channels.fetch(verificationChannelId);

  if (!verificationChannel || typeof verificationChannel.send !== "function") {
    throw new Error(
      "O canal de verificação configurado não é um canal de texto válido.",
    );
  }

  const messages = await verificationChannel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some(
        (embed) => embed.footer?.text === VERIFICATION_PANEL_FOOTER,
      ),
  );

  if (existingPanel) {
    console.info(
      `Painel de verificação encontrado em #${verificationChannel.name}.`,
    );
    return { created: false, message: existingPanel };
  }

  const panelMessage = await verificationChannel.send(
    createVerificationPanelPayload(),
  );
  console.info(`Painel de verificação criado em #${verificationChannel.name}.`);
  return { created: true, message: panelMessage };
}

export async function verifyMember(interaction) {
  const membroRoleId = getConfiguredRoleId("membro");

  if (!membroRoleId) {
    await interaction.reply({
      content: "O cargo de membro ainda não foi configurado. Avise a equipe.",
      ephemeral: true,
    });
    return;
  }

  const membroCertificadoRoleId = getConfiguredRoleId("membroCertificado");
  const member = interaction.member;

  if (
    member.roles.cache.has(membroRoleId) ||
    (membroCertificadoRoleId &&
      member.roles.cache.has(membroCertificadoRoleId))
  ) {
    await interaction.reply({
      content: "Você já está verificado!",
      ephemeral: true,
    });
    return;
  }

  try {
    await member.roles.add(membroRoleId, "Verificação concluída");
    await interaction.reply({
      content: "✅ Verificação concluída! Bem-vindo(a) ao EB Zarkano.",
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "Não foi possível atribuir o cargo de membro na verificação:",
      error,
    );
    await interaction.reply({
      content:
        "Não foi possível concluir sua verificação agora. Tente novamente em instantes.",
      ephemeral: true,
    });
  }
}
