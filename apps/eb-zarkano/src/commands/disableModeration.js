import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { disableModeration } from "../services/moderationState.js";

export const data = new SlashCommandBuilder()
  .setName("desativarmod")
  .setDescription("Desativa a moderação automática neste canal.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!interaction.guild || !interaction.channel) {
    await interaction.reply({
      content: "Este comando só pode ser usado dentro de um servidor.",
      ephemeral: true,
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Apenas administradores podem desativar a moderação.",
      ephemeral: true,
    });
    return;
  }

  await disableModeration(interaction.channel.id);
  await interaction.reply({
    content:
      "🛡️ A moderação automática foi desativada neste canal. O Anti-Spam e o filtro de linguagem não vão analisar novas mensagens aqui.",
    ephemeral: true,
  });
}