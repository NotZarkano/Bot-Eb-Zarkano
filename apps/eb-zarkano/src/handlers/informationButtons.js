import {
  createRulesEmbed,
  informationButtonIds,
  informationLinks,
} from "../services/informationSystem.js";

export async function handleInformationButton(interaction) {
  // O botão "Jogo" agora é um link direto. Isto só responde se alguém
  // clicar num painel antigo que ainda tenha o botão de antes.
  if (interaction.customId === informationButtonIds.game) {
    await interaction.reply({
      content: `🎮 Jogue o Exército Brasileiro Zarkano no Roblox: ${informationLinks.robloxGame}`,
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