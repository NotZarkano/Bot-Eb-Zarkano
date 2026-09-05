import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { sendWelcomeMessage } from "../services/welcomeMessage.js";

export const data = new SlashCommandBuilder()
  .setName("teste-boasvindas")
  .setDescription("Envia uma mensagem de teste no canal de boas-vindas.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      content: "Este comando só pode ser usado dentro de um servidor.",
      ephemeral: true,
    });
    return;
  }

  const result = await sendWelcomeMessage({
    guild: interaction.guild,
    member: interaction.member,
  });

  if (!result.sent) {
    await interaction.reply({
      content: result.reason,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: "Mensagem de teste enviada no canal de boas-vindas.",
    ephemeral: true,
  });
}