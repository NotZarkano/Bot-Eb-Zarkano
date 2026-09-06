import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const lockedChannelPermissions = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
};

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

  await channel.permissionOverwrites.edit(
    guild.roles.everyone,
    lockedChannelPermissions,
    { reason: `Canal trancado por ${interaction.user.tag}` },
  );

  const nonAdministratorRoles = guild.roles.cache.filter(
    (role) =>
      role.id !== guild.roles.everyone.id &&
      !role.managed &&
      !role.permissions.has(PermissionFlagsBits.Administrator),
  );

  for (const role of nonAdministratorRoles.values()) {
    await channel.permissionOverwrites.edit(
      role,
      lockedChannelPermissions,
      { reason: `Canal trancado por ${interaction.user.tag}` },
    );
  }

  await interaction.editReply({
    content: "🔒 Este canal foi trancado. Apenas administradores podem conversar aqui.",
  });
}
