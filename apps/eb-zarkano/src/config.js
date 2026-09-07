const requiredEnvironment = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];

export function getConfig() {
  const missing = requiredEnvironment.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(", ")}. Configure-as nos Secrets do projeto.`,
    );
  }

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    robloxApiKey: process.env.ROBLOX_OPEN_CLOUD_API_KEY ?? null,
  };
}
