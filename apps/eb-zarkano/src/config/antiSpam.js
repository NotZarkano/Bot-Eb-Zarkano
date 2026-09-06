/**
 * Configuração inicial do Anti-Spam.
 *
 * Estes limites ficam centralizados para que possam virar comandos
 * administrativos em uma próxima etapa.
 */
export const antiSpamConfig = Object.freeze({
  enabled: true,
  analysisWindowMs: 10_000,
  contentWindowMs: 30_000,
  maxTrackedMessagesPerUser: 40,
  rapidMessageThreshold: 5,
  repeatedMessageThreshold: 1,
  similarMessageThreshold: 0.86,
  warningRiskScore: 4,
  deletionRiskScore: 7,
  warningCooldownMs: 30_000,
  historyWindowMs: 24 * 60 * 60 * 1_000,
  maxMessagesDeletedPerEvent: 5,
  allowedDomains: Object.freeze([
    "discord.com",
    "discord.gg",
    "ebzarkano.onrender.com",
    "roblox.com",
    "youtube.com",
    "youtu.be",
  ]),
});