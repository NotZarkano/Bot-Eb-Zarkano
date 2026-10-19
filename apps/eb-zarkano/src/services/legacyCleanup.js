import { getConfiguredChannelId } from "../config/channels.js";

// O sistema de tickets do bot foi removido. Apaga o painel antigo
// ("Abrir ticket") que o bot tinha deixado no canal de tickets.
const LEGACY_TICKET_OPEN_BUTTON_ID = "tickets:open";

export async function removeLegacyTicketPanel(client) {
  const ticketsChannelId = getConfiguredChannelId("tickets");

  if (!ticketsChannelId) {
    return;
  }

  const channel = await client.channels.fetch(ticketsChannelId);

  if (!channel?.messages) {
    return;
  }

  const messages = await channel.messages.fetch({ limit: 50 });
  const panels = messages.filter(
    (message) =>
      message.author.id === client.user.id &&
      message.components.some((row) =>
        row.components.some(
          (component) => component.customId === LEGACY_TICKET_OPEN_BUTTON_ID,
        ),
      ),
  );

  for (const panel of panels.values()) {
    await panel.delete();
    console.info(`Painel antigo de tickets apagado em #${channel.name}.`);
  }
}
