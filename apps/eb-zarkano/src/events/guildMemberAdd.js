import { sendWelcomeMessage } from "../services/welcomeMessage.js";

export async function handleGuildMemberAdd(member) {
  try {
    const result = await sendWelcomeMessage({
      guild: member.guild,
      member,
    });

    if (!result.sent) {
      console.warn(result.reason);
      return;
    }
  } catch (error) {
    console.error("Não foi possível enviar a mensagem de boas-vindas:", error);
  }
}