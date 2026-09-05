import {
  closeTicket,
  createTicket,
  ticketButtonIds,
} from "../services/ticketSystem.js";

export async function handleTicketButton(interaction) {
  if (interaction.customId === ticketButtonIds.open) {
    await createTicket(interaction);
    return true;
  }

  if (interaction.customId === ticketButtonIds.close) {
    await closeTicket(interaction);
    return true;
  }

  return false;
}