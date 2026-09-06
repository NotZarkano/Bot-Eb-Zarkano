import { handleAntiSpamMessage } from "../services/antiSpamService.js";
import { handleLanguageFilterMessage } from "../services/languageFilterService.js";

export async function handleMessageCreate(message) {
  const languageMessageDeleted = await handleLanguageFilterMessage(message);

  if (!languageMessageDeleted) {
    await handleAntiSpamMessage(message);
  }
}