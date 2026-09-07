import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { getConfiguredRoleId } from "../config/roles.js";
import { logAction } from "./auditLog.js";

const TICKET_OWNER_PREFIX = "eb-zarkano-ticket-owner:";
const TICKET_ASSIGNEE_SEPARATOR = "|assignee:";
const EB_ZARKANO_GREEN = 0x8fc63f;
const EB_ZARKANO_GOLD = 0xf2c94c;

export const ticketButtonIds = Object.freeze({
  open: "tickets:open",
  close: "tickets:close",
  assume: "tickets:assume",
});

function getChannelMention(channelKey, fallback) {
  const channelId = getConfiguredChannelId(channelKey);
  return channelId ? `<#${channelId}>` : fallback;
}

function isStaffMember(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const staffRoleId = getConfiguredRoleId("staff");

  if (!staffRoleId) {
    return false;
  }

  return interaction.member?.roles?.cache?.has(staffRoleId) ?? false;
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

  return channel.topic
    .slice(TICKET_OWNER_PREFIX.length)
    .split(TICKET_ASSIGNEE_SEPARATOR, 1)[0];
}

function getTicketAssigneeId(channel) {
  if (!channel.topic?.startsWith(TICKET_OWNER_PREFIX)) {
    return null;
  }

  const assigneeId = channel.topic
    .slice(TICKET_OWNER_PREFIX.length)
    .split(TICKET_ASSIGNEE_SEPARATOR)[1];

  return assigneeId || null;
}

function createTicketActionRow(assigneeLabel = null) {
  const assumeButton = new ButtonBuilder()
    .setCustomId(ticketButtonIds.assume)
    .setLabel(assigneeLabel ? `Assumido por ${assigneeLabel}` : "Assumir ticket")
    .setEmoji("👮")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(Boolean(assigneeLabel));

  const closeButton = new ButtonBuilder()
    .setCustomId(ticketButtonIds.close)
    .setLabel("Fechar ticket")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(assumeButton, closeButton);
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

async function buildTicketTranscript(channel) {
  const fetchedMessages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = [...fetchedMessages.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );

  const lines = sortedMessages.map((message) => {
    const time = new Date(message.createdTimestamp).toLocaleString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const author = message.author.tag;
    const content = message.content || "[sem texto — embed ou anexo]";
    return `[${time}] ${author}: ${content}`;
  });

  return {
    text: lines.join("\n") || "Nenhuma mensagem registrada neste ticket.",
    count: sortedMessages.length,
  };
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
  const ticketEmbed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GOLD)
    .setTitle("🎫 Atendimento aberto")
    .setDescription(
      [
        `${user}, seu atendimento foi criado com sucesso.`,
        "",
        "Explique com detalhes o motivo do contato e aguarde a equipe do EB Zarkano.",
        "Um membro da equipe pode assumir o atendimento pelo botão abaixo.",
        "Quando o atendimento terminar, use o botão de fechar o ticket.",
      ].join("\n"),
    )
    .setFooter({ text: "EB Zarkano • Atendimento privado" })
    .setTimestamp();

  await ticketChannel.send({
    content: `${user}`,
    embeds: [ticketEmbed],
    components: [createTicketActionRow()],
  });

  await interaction.reply({
    content: `Seu ticket foi criado: ${ticketChannel}`,
    ephemeral: true,
  });
}

export async function assumeTicket(interaction) {
  const channel = interaction.channel;

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "Este botão só pode ser usado dentro de um ticket.",
      ephemeral: true,
    });
    return;
  }

  if (!isStaffMember(interaction)) {
    await interaction.reply({
      content: "Apenas a Staff pode assumir um ticket.",
      ephemeral: true,
    });
    return;
  }

  const currentAssigneeId = getTicketAssigneeId(channel);

  if (currentAssigneeId) {
    const currentAssignee = await interaction.guild.members
      .fetch(currentAssigneeId)
      .catch(() => null);
    const assigneeMention = currentAssignee
      ? `${currentAssignee}`
      : `<@${currentAssigneeId}>`;

    await interaction.reply({
      content: `Este ticket já foi assumido por ${assigneeMention}.`,
      ephemeral: true,
    });
    return;
  }

  const ownerId = getTicketOwnerId(channel);

  if (!ownerId) {
    await interaction.reply({
      content: "Não consegui identificar o dono deste ticket.",
      ephemeral: true,
    });
    return;
  }

  const staffLabel =
    interaction.member?.displayName || interaction.user.username;
  const newTopic = `${TICKET_OWNER_PREFIX}${ownerId}${TICKET_ASSIGNEE_SEPARATOR}${interaction.user.id}`;

  await channel.setTopic(newTopic, `Ticket assumido por ${interaction.user.tag}`);
  await interaction.update({
    components: [createTicketActionRow(staffLabel)],
  });

  await channel
    .send(`👮 ${interaction.user} assumiu este atendimento.`)
    .catch((error) => {
      console.error("Não foi possível registrar a assunção do ticket:", error);
    });

  await logAction(interaction.client, {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf2c94c)
        .setTitle("👮 Ticket assumido")
        .addFields(
          { name: "Ticket", value: `${channel}`, inline: true },
          { name: "Assumido por", value: `${interaction.user}`, inline: true },
        )
        .setTimestamp(),
    ],
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

  if (!isOwner && !isStaffMember(interaction)) {
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

  const { text: transcriptText, count: messageCount } =
    await buildTicketTranscript(channel).catch((error) => {
      console.error("Não foi possível gerar o transcript do ticket:", error);
      return { text: "Não foi possível gerar o transcript.", count: 0 };
    });

  const openedAt = new Date(channel.createdTimestamp);
  const closedAt = new Date();
  const motivo = isOwner
    ? "Fechado pelo próprio autor."
    : `Fechado pela equipe (${interaction.user.tag}).`;

  const summaryEmbed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GOLD)
    .setTitle("🎫 Ticket fechado")
    .addFields(
      { name: "Nome do ticket", value: channel.name, inline: false },
      {
        name: "Autor",
        value: ownerId ? `<@${ownerId}>` : "Desconhecido",
        inline: true,
      },
      { name: "Fechado por", value: `${interaction.user}`, inline: true },
      { name: "Abertura", value: openedAt.toLocaleString("pt-BR"), inline: true },
      { name: "Encerramento", value: closedAt.toLocaleString("pt-BR"), inline: true },
      { name: "Motivo", value: motivo, inline: false },
      { name: "Mensagens", value: `${messageCount}`, inline: true },
    )
    .setFooter({ text: "EB Zarkano • Atendimento" })
    .setTimestamp();

  if (ownerId) {
    try {
      const ownerMember = await interaction.guild.members
        .fetch(ownerId)
        .catch(() => null);

      if (ownerMember) {
        await ownerMember.send({
          embeds: [summaryEmbed],
          files: [
            new AttachmentBuilder(Buffer.from(transcriptText, "utf-8"), {
              name: `transcript-${channel.name}.txt`,
            }),
          ],
        });
      }
    } catch (error) {
      console.warn(
        `Não foi possível enviar o relatório do ticket por DM: ${error.message}`,
      );
    }
  }

  await logAction(interaction.client, {
    embeds: [summaryEmbed],
    files: [
      new AttachmentBuilder(Buffer.from(transcriptText, "utf-8"), {
        name: `transcript-${channel.name}.txt`,
      }),
    ],
  });

  setTimeout(() => {
    channel
      .delete("Ticket encerrado pelo usuário ou pela equipe.")
      .catch((error) => {
        console.error("Não foi possível fechar o ticket:", error);
      });
  }, 3_000);
}
