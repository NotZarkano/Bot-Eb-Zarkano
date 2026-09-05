import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";

const TICKET_OWNER_PREFIX = "eb-zarkano-ticket-owner:";
const EB_ZARKANO_GREEN = 0x8fc63f;
const EB_ZARKANO_GOLD = 0xf2c94c;

export const ticketButtonIds = Object.freeze({
  open: "tickets:open",
  close: "tickets:close",
});

function getChannelMention(channelKey, fallback) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId ? `<#${channelId}>` : fallback;
}

function createTicketPanelPayload() {
  const informationChannel = getChannelMention(
    "informacoes",
    "o canal de informações",
  );
  const recruitmentChannel = getChannelMention(
    "recrutamento",
    "o canal de recrutamento",
  );

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("🎫 Central de Atendimento — EB Zarkano")
    .setDescription(
      [
        "Precisa de ajuda, tem uma dúvida ou quer falar com a equipe?",
        "",
        "Clique no botão abaixo para abrir um atendimento privado. Nossa equipe responderá assim que possível.",
        "",
        `Antes de abrir um ticket, confira ${informationChannel} e ${recruitmentChannel}.`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "🛠️ Suporte",
        value: "Relate problemas, dúvidas ou qualquer situação que precise de orientação.",
        inline: true,
      },
      {
        name: "🎫 Atendimento privado",
        value: "Cada membro pode manter apenas um ticket aberto por vez.",
        inline: true,
      },
    )
    .setFooter({ text: "EB Zarkano • Atendimento oficial" })
    .setTimestamp();

  const openButton = new ButtonBuilder()
    .setCustomId(ticketButtonIds.open)
    .setLabel("Abrir ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(openButton)],
  };
}

export async function ensureTicketPanel(client) {
  const ticketsChannelId = getConfiguredChannelId("tickets");

  if (!ticketsChannelId) {
    console.warn(
      "Canal de tickets não configurado. Preencha channelIds.tickets em src/config/channels.js.",
    );
    return { created: false, reason: "missing-channel" };
  }

  const ticketsChannel = await client.channels.fetch(ticketsChannelId);

  if (!ticketsChannel || typeof ticketsChannel.send !== "function") {
    throw new Error("O canal de tickets configurado não é um canal de texto válido.");
  }

  const messages = await ticketsChannel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.components.some((row) =>
        row.components.some(
          (component) => component.customId === ticketButtonIds.open,
        ),
      ),
  );

  if (existingPanel) {
    console.info(`Painel de tickets encontrado em #${ticketsChannel.name}.`);
    return { created: false, message: existingPanel };
  }

  const panelMessage = await ticketsChannel.send(createTicketPanelPayload());
  console.info(`Painel de tickets criado em #${ticketsChannel.name}.`);
  return { created: true, message: panelMessage };
}

function getTicketOwnerId(channel) {
  if (!channel.topic?.startsWith(TICKET_OWNER_PREFIX)) {
    return null;
  }

  return channel.topic.slice(TICKET_OWNER_PREFIX.length);
}

function createTicketChannelName(user) {
  const username = user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return `ticket-${username || "membro"}-${user.id.slice(-4)}`;
}

export async function createTicket(interaction) {
  const { guild, user } = interaction;

  if (!guild) {
    await interaction.reply({
      content: "Os tickets só podem ser abertos dentro do servidor.",
      ephemeral: true,
    });
    return;
  }

  const existingTicket = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      getTicketOwnerId(channel) === user.id,
  );

  if (existingTicket) {
    await interaction.reply({
      content: `Você já possui um ticket aberto: ${existingTicket}.`,
      ephemeral: true,
    });
    return;
  }

  const panelChannelId = getConfiguredChannelId("tickets");
  const panelChannel = panelChannelId
    ? await guild.channels.fetch(panelChannelId)
    : null;
  const botMember = guild.members.me;

  if (!botMember) {
    await interaction.reply({
      content: "Não consegui identificar minhas permissões no servidor.",
      ephemeral: true,
    });
    return;
  }

  const ticketOptions = {
    name: createTicketChannelName(user),
    type: ChannelType.GuildText,
    topic: `${TICKET_OWNER_PREFIX}${user.id}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
    reason: `Ticket aberto por ${user.tag}`,
  };

  if (panelChannel?.parentId) {
    ticketOptions.parent = panelChannel.parentId;
  }

  const ticketChannel = await guild.channels.create(ticketOptions);
  const closeButton = new ButtonBuilder()
    .setCustomId(ticketButtonIds.close)
    .setLabel("Fechar ticket")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  const ticketEmbed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GOLD)
    .setTitle("🎫 Atendimento aberto")
    .setDescription(
      [
        `${user}, seu atendimento foi criado com sucesso.`,
        "",
        "Explique com detalhes o motivo do contato e aguarde a equipe do EB Zarkano.",
        "Quando o atendimento terminar, use o botão abaixo para fechar este ticket.",
      ].join("\n"),
    )
    .setFooter({ text: "EB Zarkano • Atendimento privado" })
    .setTimestamp();

  await ticketChannel.send({
    content: `${user}`,
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder().addComponents(closeButton)],
  });

  await interaction.reply({
    content: `Seu ticket foi criado: ${ticketChannel}`,
    ephemeral: true,
  });
}

export async function closeTicket(interaction) {
  const channel = interaction.channel;

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "Este botão só pode ser usado dentro de um ticket.",
      ephemeral: true,
    });
    return;
  }

  const ownerId = getTicketOwnerId(channel);
  const isOwner = ownerId === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageChannels,
  );

  if (!isOwner && !isStaff) {
    await interaction.reply({
      content: "Apenas o dono do ticket ou a equipe responsável pode fechá-lo.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: "Este ticket será fechado em alguns segundos.",
    ephemeral: true,
  });

  setTimeout(() => {
    channel
      .delete("Ticket encerrado pelo usuário ou pela equipe.")
      .catch((error) => {
        console.error("Não foi possível fechar o ticket:", error);
      });
  }, 3_000);
}