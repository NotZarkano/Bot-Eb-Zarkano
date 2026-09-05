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
      recentWelcomeEvents.delete(eventKey);
    }
  } catch (error) {
    recentWelcomeEvents.delete(eventKey);
    console.error("Não foi possível enviar a mensagem de boas-vindas:", error);
  }
}