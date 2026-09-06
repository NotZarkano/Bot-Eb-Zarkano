import {
  verificationButtonIds,
  verifyMember,
} from "../services/verificationSystem.js";

export async function handleVerificationButton(interaction) {
  if (interaction.customId === verificationButtonIds.verify) {
    await verifyMember(interaction);
    return true;
  }

  return false;
}
