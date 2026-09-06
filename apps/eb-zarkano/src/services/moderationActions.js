import { PermissionFlagsBits } from "discord.js";

export async function applyProgressiveTimeout(
  message,
  occurrence,
  reason,
) {
  if (
    occurrence < 3 ||
    !message.member?.moderatable ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return false;
  }

  const durationMs =
    occurrence >= 5 ? 2 * 60 * 60 * 1_000 : occurrence >= 4 ? 30 * 60 * 1_000 : 10 * 60 * 1_000;

  try {
    await message.member.timeout(durationMs, reason);
    return true;
  } catch (error) {
    console.error("Não foi possível aplicar timeout progressivo:", error);
    return false;
  }
}