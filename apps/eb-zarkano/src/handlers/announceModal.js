import { EmbedBuilder } from "discord.js";
import {
  announceMessageId,
  announceModalId,
  announceTitleId,
} from "../commands/anunciar.js";

const EB_ZARKANO_GREEN = 0x8fc63f;

export async function handleAnnounceModal(interaction) {
  if (interaction.customId !== announceModalId) {
    return false;
  }

  const titulo = interaction.fields.getTextInputValue(announceTitleId);
  const mensagem = interaction.fields.getTextInputValue(announceMessageId);

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle(titulo)
    .setDescription(mensagem)
    .setFooter({ text: "EB Zarkano" })
    .setTimestamp();

  await interaction.channel.send({ embeds: [embed] });

  await interaction.reply({
    content: "✅ Anúncio publicado com sucesso.",
    ephemeral: true,
  });

  return true;
}
