import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("anunciar")
  .setDescription(
    "Abre um formulário para enviar um anúncio formatado neste canal.",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const announceModalId = "anunciar:modal";
export const announceTitleId = "anunciar:titulo";
export const announceMessageId = "anunciar:mensagem";

export async function execute(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(announceModalId)
    .setTitle("Novo anúncio");

  const titleInput = new TextInputBuilder()
    .setCustomId(announceTitleId)
    .setLabel("Título")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId(announceMessageId)
    .setLabel("Mensagem")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(messageInput),
  );

  await interaction.showModal(modal);
}
