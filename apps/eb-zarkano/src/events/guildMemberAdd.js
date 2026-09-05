import { getConfiguredChannelId } from "../config/channels.js";

export async function handleGuildMemberAdd(member) {
  const welcomeChannelId = getConfiguredChannelId("boasVindas");

  if (!welcomeChannelId) {
    console.warn(
      "Canal de boas-vindas não configurado. Preencha channelIds.boasVindas em src/config/channels.js.",
    );
    return;
  }

  try {
    const welcomeChannel =
      await member.guild.channels.fetch(welcomeChannelId);

    if (!welcomeChannel || typeof welcomeChannel.send !== "function") {
      console.warn(
        `O canal configurado para boas-vindas não é um canal de texto válido: ${welcomeChannelId}.`,
      );
      return;
    }

    await welcomeChannel.send(
      `Seja bem-vindo(a), ${member}, ao servidor! Esperamos que você aproveite a comunidade.`,
    );
  } catch (error) {
    console.error(
      `Não foi possível enviar a mensagem de boas-vindas no canal ${welcomeChannelId}:`,
      error,
    );
  }
}