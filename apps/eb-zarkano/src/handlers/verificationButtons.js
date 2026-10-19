import { syncMember } from "../services/rankSync.js";
import {
  sendHelp,
  sendLinkInstructions,
  verificationButtonIds,
} from "../services/verificationSystem.js";

export async function handleVerificationButton(interaction) {
  if (interaction.customId === verificationButtonIds.sync) {
    await syncMember(interaction);
    return true;
  }

  if (interaction.customId === verificationButtonIds.link) {
    await sendLinkInstructions(interaction);
    return true;
  }

  if (interaction.customId === verificationButtonIds.help) {
    await sendHelp(interaction);
    return true;
  }

  return false;
}
