import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { findDiscordLink } from "./database.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
// Rodapé do painel antigo (botão "Verificar"). O bot apaga esse painel.
const LEGACY_VERIFICATION_PANEL_FOOTER = "EB Zarkano • Verificação";
const VERIFICATION_PANEL_FOOTER = "EB Zarkano • Vínculo Roblox";
const SITE_URL = "https://ebzarkano.onrender.com";

export const verificationButtonIds = Object.freeze({
  sync: "verification:sync",
  link: "verification:link",
  help: "verification:help",
});

function createVerificationPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("🔗 Verificação — EB Zarkano")
    .setDescription(
      [
        "Vincule sua conta do Roblox para receber sua patente, o cargo de membro e o apelido certo aqui no Discord.",
        "",
        "**Primeira vez?** Clique em **Vincular conta** e siga o passo a passo.",
        "**Já vinculou?** Clique em **Sincronizar agora** sempre que sua patente mudar.",
        "",
        "Ao verificar, você concorda em seguir as regras do Exército Brasileiro — EB Zarkano.",
      ].join("\n"),
    )
    .setFooter({ text: VERIFICATION_PANEL_FOOTER });

  const syncButton = new ButtonBuilder()
    .setCustomId(verificationButtonIds.sync)
    .setLabel("Sincronizar agora")
    .setEmoji("🔄")
    .setStyle(ButtonStyle.Success);

  const linkButton = new ButtonBuilder()
    .setCustomId(verificationButtonIds.link)
    .setLabel("Vincular conta")
    .setEmoji("🔗")
    .setStyle(ButtonStyle.Primary);

  const helpButton = new ButtonBuilder()
    .setCustomId(verificationButtonIds.help)
    .setLabel("Problema?")
    .setEmoji("❓")
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(syncButton, linkButton, helpButton),
    ],
  };
}

function hasFooter(message, footerText) {
  return message.embeds.some((embed) => embed.footer?.text === footerText);
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
  const botMessages = messages.filter(
    (message) => message.author.id === client.user.id,
  );

  for (const legacyPanel of botMessages
    .filter((message) => hasFooter(message, LEGACY_VERIFICATION_PANEL_FOOTER))
    .values()) {
    try {
      await legacyPanel.delete();
      console.info(
        `Painel antigo de verificação apagado em #${verificationChannel.name}.`,
      );
    } catch (error) {
      console.error("Não foi possível apagar o painel antigo de verificação:", error);
    }
  }

  const existingPanel = botMessages.find((message) =>
    hasFooter(message, VERIFICATION_PANEL_FOOTER),
  );

  if (existingPanel) {
    await existingPanel.edit(createVerificationPanelPayload());
    console.info(
      `Painel de verificação atualizado em #${verificationChannel.name}.`,
    );
    return { created: false, message: existingPanel };
  }

  const panelMessage = await verificationChannel.send(
    createVerificationPanelPayload(),
  );
  console.info(`Painel de verificação criado em #${verificationChannel.name}.`);
  return { created: true, message: panelMessage };
}

export async function sendLinkInstructions(interaction) {
  let link = null;

  try {
    link = await findDiscordLink(interaction.user.id);
  } catch (error) {
    // Sem banco ou sem tabela: só mostra o passo a passo.
    link = null;
  }

  if (link) {
    await interaction.reply({
      content: [
        `✅ Seu Discord já está vinculado à conta do Roblox **${link.robloxUsername || link.robloxId}**.`,
        "Clique em **Sincronizar agora** para atualizar sua patente e seu apelido.",
        `Quer trocar de conta? Entre em ${SITE_URL}, abra o **Perfil**, clique em **Desvincular** e vincule de novo.`,
      ].join("\n"),
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("🔗 Como vincular sua conta")
    .setDescription(
      [
        `**1.** Entre em ${SITE_URL} e faça login com o **Roblox**.`,
        "**2.** Abra a aba **Perfil** e clique em **Vincular Discord**.",
        "**3.** Autorize no Discord (é só confirmar quem você é).",
        "**4.** Volte aqui e clique em **Sincronizar agora**.",
      ].join("\n"),
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function sendHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("❓ Problemas comuns")
    .setDescription(
      [
        "**\"Seu Discord ainda não está vinculado\"** — faça o passo a passo do botão **Vincular conta**.",
        "**\"Não está no grupo\"** — entre no grupo do EB Zarkano no Roblox e sincronize de novo.",
        "**Patente errada** — sua patente mudou há pouco? Espere alguns minutos e sincronize de novo.",
        "**Apelido não mudou** — o bot não consegue mudar o apelido do dono do servidor nem de quem tem cargo acima do bot.",
        "**Vinculou a conta errada** — no site, no seu perfil, clique em **Desvincular** e vincule de novo.",
        "",
        "Ainda com problema? Fale com a equipe.",
      ].join("\n"),
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function sendVerificationPrompt(member) {
  const verificationChannelId = getConfiguredChannelId("verificacao");

  if (!verificationChannelId) {
    return { sent: false, reason: "missing-channel" };
  }

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("✅ Falta pouco para você ter acesso completo!")
    .setDescription(
      [
        `Olá, ${member}! Para liberar o restante do servidor **EB Zarkano**, acesse o canal <#${verificationChannelId}>, vincule sua conta do Roblox e clique em **Sincronizar agora**.`,
      ].join("\n"),
    )
    .setFooter({ text: VERIFICATION_PANEL_FOOTER })
    .setTimestamp();

  try {
    await member.send({ embeds: [embed] });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: "dm-closed" };
  }
}
