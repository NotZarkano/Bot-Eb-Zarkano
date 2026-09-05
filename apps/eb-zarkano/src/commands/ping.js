import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica se o EB Zarkano está online.");

export async function execute(interaction) {
  await interaction.reply({
    content: `Pong! Latência: ${interaction.client.ws.ping}ms.`,
    ephemeral: true,
  });
}