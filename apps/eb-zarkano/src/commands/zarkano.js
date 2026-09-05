import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("zarkano")
  .setDescription("Apresenta o EB Zarkano.");

export async function execute(interaction) {
  await interaction.reply(
    "Salve! Eu sou o EB Zarkano, seu bot oficial do Discord.",
  );
}