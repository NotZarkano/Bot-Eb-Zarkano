import { getConfiguredChannelId } from "../config/channels.js";

export async function sendWelcomeMessage({ guild, member }) {
  const welcomeChannelId = getConfiguredChannelId("boasVindas");

  if (!welcomeChannelId) {
    return {
      sent: false,
      reason:
        "O canal de boas-vindas ainda não foi configurado em src/config/channels.js.",
    };
  }

  const welcomeChannel = await guild.channels.fetch(welcomeChannelId);

  if (!welcomeChannel || typeof welcomeChannel.send !== "function") {
    return {
      sent: false,
      reason:
        "O canal configurado para boas-vindas não é um canal de texto válido.",
    };
  }

  await welcomeChannel.send(
    `Seja bem-vindo(a), ${member}, ao servidor! Esperamos que você aproveite a comunidade.`,
  );

  return { sent: true };
}