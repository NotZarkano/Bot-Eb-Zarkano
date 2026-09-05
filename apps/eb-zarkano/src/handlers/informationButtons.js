import {
  createRulesEmbed,
  informationButtonIds,
} from "../services/informationSystem.js";

export async function handleInformationButton(interaction) {
  if (interaction.customId !== informationButtonIds.rules) {
    return false;
  }

  await interaction.reply({
    embeds: [createRulesEmbed()],
    ephemeral: true,
  });

  return true;
}