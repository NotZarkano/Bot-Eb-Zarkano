import { getConfiguredChannelId } from "../config/channels.js";
import { welcomeButtonIds } from "../services/welcomeMessage.js";

function getChannelMention(channelKey, fallback) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId ? `<#${channelId}>` : fallback;
}

export async function handleWelcomeButton(interaction) {
  const responses = {
    [welcomeButtonIds.information]: `Confira todas as orientações em ${getChannelMention("informacoes", "o canal de informações")}.`,
    [welcomeButtonIds.recruitment]: `Para fazer parte do EB Zarkano, acesse ${getChannelMention("recrutamento", "o canal de recrutamento")}.`,
    [welcomeButtonIds.support]: `Nossa equipe está pronta para ajudar. Abra seu atendimento em ${getChannelMention("tickets", "o canal de tickets")}.`,
    [welcomeButtonIds.play]: `Para começar a jogar, consulte as instruções em ${getChannelMention("informacoes", "o canal de informações")}.`,
  };
  const response = responses[interaction.customId];

  if (!response) {
    return false;
  }

  await interaction.reply({
    content: response,
    ephemeral: true,
  });

  return true;
}