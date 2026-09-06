import {
  createRulesEmbed,
  informationButtonIds,
} from "../services/informationSystem.js";

export async function handleInformationButton(interaction) {
  if (interaction.customId === informationButtonIds.robloxGroup) {
    await interaction.reply({
      content: "O jogo ainda está em desenvolvimento.",
      ephemeral: true,
    });
    return true;
  }

  if (interaction.customId !== informationButtonIds.rules) {
    return false;
  }

  await interaction.reply({
    embeds: [createRulesEmbed()],
    ephemeral: true,
  });

  return true;
}