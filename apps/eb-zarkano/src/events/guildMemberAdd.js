import { sendVerificationPrompt } from "../services/verificationSystem.js";
import { sendWelcomeMessage } from "../services/welcomeMessage.js";

const recentWelcomeEvents = new Map();
const DUPLICATE_WINDOW_MS = 60_000;

export async function handleGuildMemberAdd(member) {
  const eventKey = `${member.guild.id}:${member.id}`;
  const now = Date.now();
  const previousEventExpiresAt = recentWelcomeEvents.get(eventKey);

  if (previousEventExpiresAt && previousEventExpiresAt > now) {
    return;
  }

  recentWelcomeEvents.set(eventKey, now + DUPLICATE_WINDOW_MS);

  try {
    const result = await sendWelcomeMessage({
      guild: member.guild,
      member,
    });

    if (!result.sent) {
      console.warn(result.reason);
    }
  } catch (error) {
    console.error("Não foi possível enviar a mensagem de boas-vindas:", error);
  }

  try {
    const dmResult = await sendVerificationPrompt(member);

    if (!dmResult.sent) {
      console.warn(
        `Não foi possível enviar DM de verificação para ${member.user.tag}: ${dmResult.reason}`,
      );
    }
  } catch (error) {
    console.error("Não foi possível enviar o aviso de verificação por DM:", error);
  }
}
