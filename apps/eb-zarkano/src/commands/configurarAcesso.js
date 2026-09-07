import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";

export const data = new SlashCommandBuilder()
  .setName("configurar-acesso")
  .setDescription(
    "Esconde todos os canais do servidor para @everyone, exceto portaria e verificação.",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Este comando só pode ser usado dentro de um servidor.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const { guild } = interaction;
  const everyoneId = guild.roles.everyone.id;

  const allowedChannelIds = new Set(
    [
      getConfiguredChannelId("boasVindas"),
      getConfiguredChannelId("verificacao"),
    ].filter(Boolean),
  );

  const allChannels = await guild.channels.fetch();
  let updated = 0;
  let failed = 0;

  for (const channel of allChannels.values()) {
    if (!channel) {
      continue;
    }

    const isAllowed = allowedChannelIds.has(channel.id);

    try {
      await channel.permissionOverwrites.edit(everyoneId, {
        ViewChannel: isAllowed,
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Não foi possível ajustar permissões do canal ${channel.name}:`,
        error,
      );
    }
  }

  await interaction.editReply({
    content: `✅ Configuração concluída. ${updated} canal(is)/categoria(s) ajustados${
      failed > 0
        ? `, ${failed} falharam (verifique se meu cargo tem permissão de gerenciar esses canais).`
        : "."
    }`,
  });
}
