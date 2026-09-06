import { sendFarewellMessage } from "../services/farewellMessage.js";

const recentFarewellEvents = new Map();
const DUPLICATE_WINDOW_MS = 60_000;

export async function handleGuildMemberRemove(member) {
  const eventKey = `${member.guild.id}:${member.id}`;
  const now = Date.now();
  const previousEventExpiresAt = recentFarewellEvents.get(eventKey);

  if (previousEventExpiresAt && previousEventExpiresAt > now) {
    return;
  }

  recentFarewellEvents.set(eventKey, now + DUPLICATE_WINDOW_MS);

  try {
    const result = await sendFarewellMessage({
      guild: member.guild,
      member,
    });

    if (!result.sent) {
      console.warn(result.reason);
      recentFarewellEvents.delete(eventKey);
    }
  } catch (error) {
    recentFarewellEvents.delete(eventKey);
    console.error("Não foi possível enviar a mensagem de saída:", error);
  }
}
