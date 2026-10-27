import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { getCdpStatus } from "../services/cdp.js";
import { findDiscordLink, LinkSystemInactiveError } from "../services/database.js";
import { fetchMemberGroupRole } from "../services/robloxGroup.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const EB_ZARKANO_GOLD = 0xf2c94c;
const SITE_URL = "https://ebzarkano.onrender.com";

export const data = new SlashCommandBuilder()
  .setName("cdp")
  .setDescription("Mostra o progresso da sua CDP (tempo na patente antes de ser promovido).")
  .addUserOption((option) =>
    option
      .setName("membro")
      .setDescription("Ver a CDP de outro membro (opcional)")
      .setRequired(false),
  );

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const text = hours === 0 ? `${minutes}min` : minutes ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${text} (${totalMinutes} minuto${totalMinutes === 1 ? "" : "s"})`;
}

function progressBar(progress) {
  const filled = Math.round(progress * 12);
  return `${"🟩".repeat(filled)}${"⬛".repeat(12 - filled)} ${Math.floor(progress * 100)}%`;
}

export async function execute(interaction) {
  const target = interaction.options.getUser("membro") ?? interaction.user;
  const isSelf = target.id === interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  let link;
  try {
    link = await findDiscordLink(target.id);
  } catch (error) {
    if (error instanceof LinkSystemInactiveError) {
      await interaction.editReply({
        content: "⚠️ O sistema de CDP ainda não está ativo. Tente novamente mais tarde.",
      });
      return;
    }
    throw error;
  }

  if (!link) {
    await interaction.editReply({
      content: isSelf
        ? `🔗 Seu Discord ainda não está vinculado ao Roblox. Entre em ${SITE_URL}, abra o **Perfil** e clique em **Vincular Discord**.`
        : `🔗 ${target} ainda não vinculou o Discord ao Roblox.`,
    });
    return;
  }

  const { robloxApiKey } = getConfig();
  if (!robloxApiKey) {
    await interaction.editReply({
      content: "⚠️ A integração com o Roblox ainda não foi configurada. Avise a equipe.",
    });
    return;
  }

  const robloxUsername = link.robloxUsername || link.robloxId;
  const groupRole = await fetchMemberGroupRole(robloxApiKey, link.robloxId);

  if (!groupRole) {
    await interaction.editReply({
      content: isSelf
        ? `❌ Sua conta do Roblox (**${robloxUsername}**) não está no grupo do EB Zarkano. Entre no grupo para ter CDP.`
        : `❌ **${robloxUsername}** não está no grupo do EB Zarkano.`,
    });
    return;
  }

  let status;
  try {
    status = await getCdpStatus(link.robloxId, groupRole);
  } catch (error) {
    // 42P01 = tabela ainda não existe (o site ainda não ligou a CDP).
    if (error.code === "42P01" || error instanceof LinkSystemInactiveError) {
      await interaction.editReply({
        content: "⚠️ O sistema de CDP ainda não está ativo. Tente novamente mais tarde.",
      });
      return;
    }
    throw error;
  }

  const embed = new EmbedBuilder()
    .setTitle(`⏳ CDP de ${robloxUsername}`)
    .addFields({ name: "Patente", value: groupRole.displayName, inline: true })
    .setFooter({ text: "EB Zarkano • CDP" })
    .setTimestamp();

  if (!status.hasCdp) {
    embed
      .setColor(EB_ZARKANO_GREEN)
      .setDescription("Essa patente não tem CDP.");
  } else if (status.inCdp) {
    const releaseUnix = Math.floor(status.releaseAt.getTime() / 1000);
    embed
      .setColor(EB_ZARKANO_GOLD)
      .setDescription(progressBar(status.progress))
      .addFields(
        { name: "CDP da patente", value: `${status.hours} horas`, inline: true },
        { name: "Faltam", value: formatRemaining(status.remainingMs), inline: false },
        { name: "Libera em", value: `<t:${releaseUnix}:f> (<t:${releaseUnix}:R>)`, inline: false },
      );
  } else {
    embed
      .setColor(EB_ZARKANO_GREEN)
      .setDescription(`${progressBar(1)}\n✅ CDP cumprida! Já pode ser promovido.`)
      .addFields({ name: "CDP da patente", value: `${status.hours} horas`, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}
