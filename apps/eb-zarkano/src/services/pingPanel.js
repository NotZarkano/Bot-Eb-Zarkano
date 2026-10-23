import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { normalizeRankName } from "../utils/rankNames.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const PING_PANEL_FOOTER = "EB Zarkano • Pings de exames";
const PING_BUTTON_PREFIX = "ping:";
const MAX_BUTTONS = 25; // limite do Discord: 5 linhas de 5 botões

// >>> Todo cargo cujo nome começa com "Notificação" vira um botão.
// "Notificação BFE" -> botão "BFE". Criar/renomear/apagar um cargo
// desses atualiza o painel sozinho.
const PING_ROLE_PREFIX = "notificacao ";

function isPingRole(role) {
  return (
    !role.managed &&
    !role.permissions.has(PermissionFlagsBits.Administrator) &&
    normalizeRankName(role.name).startsWith(PING_ROLE_PREFIX)
  );
}

function getButtonLabel(role) {
  // Tira a primeira palavra ("Notificação") e deixa o resto.
  const label = role.name.trim().replace(/^\S+\s+/, "");
  return label.slice(0, 80) || role.name.slice(0, 80);
}

function getPingRoles(guild) {
  return [...guild.roles.cache.filter(isPingRole).values()]
    .sort((a, b) => b.position - a.position)
    .slice(0, MAX_BUTTONS);
}

function createPingPanelPayload(pingRoles) {
  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("🔔 Pings de Exames")
    .setDescription(
      [
        "Clique nos botões abaixo para ser notificado quando houver um exame para ingresso em uma divisão do nosso Exército.",
        "Clique de novo no mesmo botão para deixar de receber.",
        "",
        "⭐ Boa sorte nos TAFs, vocês vão precisar!",
      ].join("\n"),
    )
    .setFooter({ text: PING_PANEL_FOOTER });

  const buttons = pingRoles.map((role) => {
    const button = new ButtonBuilder()
      .setCustomId(`${PING_BUTTON_PREFIX}${role.id}`)
      .setLabel(getButtonLabel(role))
      .setStyle(ButtonStyle.Secondary);
    if (role.unicodeEmoji) {
      button.setEmoji(role.unicodeEmoji);
    }
    return button;
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  if (rows.length === 0) {
    embed.setDescription("Nenhum ping disponível no momento.");
  }

  return { embeds: [embed], components: rows };
}

export async function ensurePingPanel(client) {
  const channelId = getConfiguredChannelId("pingsExames");

  if (!channelId) {
    return { created: false, reason: "missing-channel" };
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || typeof channel.send !== "function") {
    throw new Error("O canal de pings configurado não é um canal de texto válido.");
  }

  await channel.guild.roles.fetch();
  const payload = createPingPanelPayload(getPingRoles(channel.guild));

  const messages = await channel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some((embed) => embed.footer?.text === PING_PANEL_FOOTER),
  );

  if (existingPanel) {
    await existingPanel.edit(payload);
    console.info(`Painel de pings atualizado em #${channel.name}.`);
    return { created: false, message: existingPanel };
  }

  const panelMessage = await channel.send(payload);
  console.info(`Painel de pings criado em #${channel.name}.`);
  return { created: true, message: panelMessage };
}

// Quando um cargo muda, espera uns segundos (pra juntar várias mudanças)
// e atualiza o painel.
let refreshTimer = null;

export function schedulePingPanelRefresh(client, ...roles) {
  if (!roles.some((role) => role && normalizeRankName(role.name).startsWith(PING_ROLE_PREFIX))) {
    return;
  }

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    ensurePingPanel(client).catch((error) => {
      console.error("Não foi possível atualizar o painel de pings:", error);
    });
  }, 3000);
}

export async function handlePingButton(interaction) {
  if (!interaction.customId.startsWith(PING_BUTTON_PREFIX)) {
    return false;
  }

  const roleId = interaction.customId.slice(PING_BUTTON_PREFIX.length);
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role || !isPingRole(role)) {
    await interaction.reply({
      content: "Esse ping não existe mais.",
      ephemeral: true,
    });
    return true;
  }

  if (!role.editable) {
    await interaction.reply({
      content: `Não consigo entregar o cargo **${role.name}** (ele está acima do cargo do bot). Avise a equipe.`,
      ephemeral: true,
    });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const label = getButtonLabel(role);

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, "Painel de pings");
    await interaction.reply({
      content: `🔕 Você não vai mais receber os pings de **${label}**.`,
      ephemeral: true,
    });
  } else {
    await member.roles.add(role, "Painel de pings");
    await interaction.reply({
      content: `🔔 Pronto! Você vai receber os pings de **${label}**.`,
      ephemeral: true,
    });
  }

  return true;
}
