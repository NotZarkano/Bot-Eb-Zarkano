import { getConfiguredChannelId } from "../config/channels.js";

export async function logAction(client, payload) {
  const logsChannelId = getConfiguredChannelId("logs");

  if (!logsChannelId) {
    return;
  }

  try {
    const logsChannel = await client.channels.fetch(logsChannelId);

    if (!logsChannel || typeof logsChannel.send !== "function") {
      return;
    }

    await logsChannel.send(payload);
  } catch (error) {
    console.error("Não foi possível registrar log de auditoria:", error);
  }
}
