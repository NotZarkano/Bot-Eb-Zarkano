import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { CATEGORY_ROLE_NAMES } from "../utils/rankCategories.js";
import { normalizeRankName } from "../utils/rankNames.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const TRAINING_PANEL_FOOTER = "EB Zarkano • Scripts de treinamento";
const TRAINING_BUTTON_PREFIX = "treino:";

// Cargos de grupo (dados pela sincronização) em ordem crescente.
const OFICIAIS_OU_MAIS = [
  "oficiaisInferiores",
  "oficiaisIntermediarios",
  "oficiaisSuperiores",
  "oficiaisGenerais",
  "honorarias",
  "administracao",
];
const GENERAIS_OU_MAIS = ["oficiaisGenerais", "honorarias", "administracao"];

// >>> Scripts de treinamento. Para adicionar um novo, copie um bloco.
// grupos: cargos de grupo do Discord que podem ver o script.
const TRAININGS = [
  {
    id: "pracas-graduados",
    label: "Praças e Graduados",
    emoji: "⚔️",
    publico: "Oficiais ou acima",
    grupos: OFICIAIS_OU_MAIS,
    url: "https://docs.google.com/document/d/1QbsNanb0IXn6fKiR_5bjK54pfO2OgLvQ3l3EyJjVcCE/edit?usp=sharing",
  },
  {
    id: "oficiais",
    label: "Oficiais",
    emoji: "🎖️",
    publico: "Generais ou acima",
    grupos: GENERAIS_OU_MAIS,
    url: "https://docs.google.com/document/d/1k9_f5DEy6vUpTFtcvsPgRFIqLoVqZ-fzQeZBgKAB6bE/edit?usp=sharing",
  },
];

function createTrainingPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("📚 Scripts de Treinamento")
    .setDescription(
      "Escolha abaixo o treinamento que você vai aplicar para receber o roteiro de como ele deve ser feito.",
    )
    .setFooter({ text: TRAINING_PANEL_FOOTER });

  const row = new ActionRowBuilder().addComponents(
    TRAININGS.map((t) =>
      new ButtonBuilder()
        .setCustomId(`${TRAINING_BUTTON_PREFIX}${t.id}`)
        .setLabel(t.label)
        .setEmoji(t.emoji)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return { embeds: [embed], components: [row] };
}

export async function ensureTrainingPanel(client) {
  const channelId = getConfiguredChannelId("treinamentos");
  if (!channelId) return { created: false, reason: "missing-channel" };

  const channel = await client.channels.fetch(channelId);
  if (!channel || typeof channel.send !== "function") {
    throw new Error("O canal de treinamentos configurado não é um canal de texto válido.");
  }

  const payload = createTrainingPanelPayload();
  const messages = await channel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some((embed) => embed.footer?.text === TRAINING_PANEL_FOOTER),
  );

  if (existingPanel) {
    await existingPanel.edit(payload);
    console.info(`Painel de treinamentos atualizado em #${channel.name}.`);
    return { created: false, message: existingPanel };
  }

  const panelMessage = await channel.send(payload);
  console.info(`Painel de treinamentos criado em #${channel.name}.`);
  return { created: true, message: panelMessage };
}

// Pode ver o script quem tem um dos cargos de grupo liberados, ou quem tem
// permissão de Administrador no servidor.
function memberCanSee(member, training) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const allowedNames = new Set(training.grupos.map((key) => CATEGORY_ROLE_NAMES[key]));
  return member.roles.cache.some((role) => allowedNames.has(normalizeRankName(role.name)));
}

export async function handleTrainingButton(interaction) {
  if (!interaction.customId.startsWith(TRAINING_BUTTON_PREFIX)) return false;

  const training = TRAININGS.find(
    (t) => t.id === interaction.customId.slice(TRAINING_BUTTON_PREFIX.length),
  );
  if (!training) {
    await interaction.reply({ content: "Esse treinamento não existe mais.", ephemeral: true });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!memberCanSee(member, training)) {
    await interaction.reply({
      content: `🔒 O roteiro de **${training.label}** é só para ${training.publico}. Se sua patente mudou, clique em **Sincronizar agora** no canal de verificação.`,
      ephemeral: true,
    });
    return true;
  }

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle(`📜 Roteiro — ${training.label}`)
    .setDescription("Abra o documento pelo botão abaixo. **Não repasse** para quem não tem a patente necessária.");

  const button = new ButtonBuilder()
    .setLabel("Abrir roteiro")
    .setEmoji(training.emoji)
    .setStyle(ButtonStyle.Link)
    .setURL(training.url);

  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)],
    ephemeral: true,
  });
  return true;
}
