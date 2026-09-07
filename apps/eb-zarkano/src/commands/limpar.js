import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("limpar")
  .setDescription("Apaga uma quantidade de mensagens recentes deste canal.")
  .addIntegerOption((option) =>
    option
      .setName("quantidade")
      .setDescription("Quantidade de mensagens para apagar (1 a 100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

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

  const quantidade = interaction.options.getInteger("quantidade", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const deletedMessages = await interaction.channel.bulkDelete(
      quantidade,
      true,
    );

    await interaction.editReply({
      content: `🧹 ${deletedMessages.size} mensagem(ns) apagada(s). Mensagens com mais de 14 dias não podem ser removidas em massa pelo Discord.`,
    });
  } catch (error) {
    console.error("Não foi possível apagar mensagens:", error);
    await interaction.editReply({
      content:
        "Não foi possível apagar as mensagens agora. Tente novamente em instantes.",
    });
  }
}
