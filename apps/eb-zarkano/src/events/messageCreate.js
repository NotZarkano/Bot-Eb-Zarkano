import { handleAntiSpamMessage } from "../services/antiSpamService.js";

export function handleMessageCreate(message) {
  return handleAntiSpamMessage(message);
}