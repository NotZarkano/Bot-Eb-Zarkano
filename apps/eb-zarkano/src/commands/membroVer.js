import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getConfiguredRoleId } from "../config/roles.js";
import { logAction } from "../services/auditLog.js";

export const data = new SlashCommandBuilder()
  .setName("membrover")
  .setDescription(
    "Alterna este canal entre liberado (apenas leitura) e fechado para membros.",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function isSupportedTextChannel(channel) {
  return Boolean(
    channel &&
      (channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement),
  );
}

function isCurrentlyOpenToView(channel, roleId) {
  const overwrite = channel.permissionOverwrites.cache.get(roleId);

  if (!overwrite) {
    return false;
  }

  return (
    overwrite.allow.has(PermissionFlagsBits.ViewChannel) &&
    !overwrite.allow.has(PermissionFlagsBits.SendMessages)
  );
}

export async function execute(interaction) {
  if (!interaction.guild || !isSupportedTextChannel(interaction.channel)) {
    await interaction.reply({
      content: "Este comando só pode ser usado em um canal de texto do servidor.",
      ephemeral: true,
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Apenas administradores podem alterar este canal.",
      ephemeral: true,
    });
    return;
  }

  const membroRoleId = getConfiguredRoleId("membro");
  const membroCertificadoRoleId = getConfiguredRoleId("membroCertificado");

  if (!membroRoleId || !membroCertificadoRoleId) {
    await interaction.reply({
      content:
        "Os cargos de membro ainda não foram configurados em src/config/roles.js.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const { channel } = interaction;
  const isOpen = isCurrentlyOpenToView(channel, membroRoleId);

  const nextPermissions = isOpen
    ? {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
      }
    : {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      };

  const reason = `Canal ${isOpen ? "fechado" : "liberado para leitura"} por ${interaction.user.tag}`;

  await channel.permissionOverwrites.edit(membroRoleId, nextPermissions, {
    reason,
  });
  await channel.permissionOverwrites.edit(
    membroCertificadoRoleId,
    nextPermissions,
    { reason },
  );

  const newMode = isOpen ? "Fechado" : "Liberado (somente leitura)";
  const statusMessage = isOpen
    ? "🔒 Modo atual: **fechado**. Membros não podem ver este canal."
    : "👁️ Modo atual: **apenas leitura**. Membros e membros certificados podem ver e ler o histórico, mas não podem enviar mensagens.";

  await interaction.editReply({ content: statusMessage });

  await logAction(interaction.client, {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf2c94c)
        .setTitle("🔁 /membrover utilizado")
        .addFields(
          { name: "Canal", value: `${channel}`, inline: true },
          { name: "Novo modo", value: newMode, inline: true },
          { name: "Executado por", value: `${interaction.user}`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}
