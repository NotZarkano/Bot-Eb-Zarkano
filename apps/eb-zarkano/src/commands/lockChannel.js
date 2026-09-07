import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { logAction } from "../services/auditLog.js";

const LOCKED_BITS = new PermissionsBitField([
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.SendMessagesInThreads,
  PermissionsBitField.Flags.CreatePublicThreads,
  PermissionsBitField.Flags.CreatePrivateThreads,
]).bitfield;

export const data = new SlashCommandBuilder()
  .setName("trancar")
  .setDescription("Tranca este canal para que apenas administradores conversem.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function isSupportedTextChannel(channel) {
  return Boolean(
    channel &&
      (channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement),
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
      content: "Apenas administradores podem trancar um canal.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const { guild, channel } = interaction;

  const nonAdministratorRoleIds = new Set(
    guild.roles.cache
      .filter(
        (role) =>
          role.id !== guild.roles.everyone.id &&
          !role.managed &&
          !role.permissions.has(PermissionFlagsBits.Administrator),
      )
      .map((role) => role.id),
  );

  const targetIds = new Set([guild.roles.everyone.id, ...nonAdministratorRoleIds]);

  const existingOverwrites = channel.permissionOverwrites.cache;

  const overwritesPayload = [];

  for (const targetId of targetIds) {
    const existing = existingOverwrites.get(targetId);
    const currentAllow = existing ? existing.allow.bitfield : 0n;
    const currentDeny = existing ? existing.deny.bitfield : 0n;

    overwritesPayload.push({
      id: targetId,
      type: 0,
      allow: (currentAllow & ~LOCKED_BITS).toString(),
      deny: (currentDeny | LOCKED_BITS).toString(),
    });
  }

  for (const [id, overwrite] of existingOverwrites) {
    if (!targetIds.has(id)) {
      overwritesPayload.push({
        id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString(),
      });
    }
  }

  await channel.permissionOverwrites.set(overwritesPayload, `Canal trancado por ${interaction.user.tag}`);

  await interaction.editReply({
    content: "🔒 Este canal foi trancado. Apenas administradores podem conversar aqui.",
  });

  await logAction(interaction.client, {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf2c94c)
        .setTitle("🔒 Canal trancado")
        .addFields(
          { name: "Canal", value: `${channel}`, inline: true },
          { name: "Executado por", value: `${interaction.user}`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}
