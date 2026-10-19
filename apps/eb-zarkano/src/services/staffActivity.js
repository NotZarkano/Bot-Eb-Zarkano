import { ChannelType, EmbedBuilder } from "discord.js";
import { getConfiguredChannelId } from "../config/channels.js";
import { normalizeRankName } from "../utils/rankNames.js";
import { query } from "./database.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const INACTIVITY_LIMIT_MS = 2 * 24 * 60 * 60 * 1000; // 2 dias
const SAVE_THROTTLE_MS = 5 * 60 * 1000; // grava no banco no máximo a cada 5 min por pessoa
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // confere a cada 10 min se é hora do relatório

// >>> Horário do relatório diário: 12:00 de Brasília (15:00 UTC)
const REPORT_HOUR_UTC = 15;
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;

// >>> Cargo que todo staff tem. O bot procura pelo nome (sem emoji/acento),
// então trocar o emoji ou a cor do cargo não quebra nada.
const STAFF_ROLE_NAME = "equipe administrativa";

const lastSavedAt = new Map();
let enabled = false;

function findStaffRole(guild) {
  return guild.roles.cache.find(
    (role) => normalizeRankName(role.name) === STAFF_ROLE_NAME,
  );
}

function isStaff(member) {
  const staffRole = member?.guild && findStaffRole(member.guild);
  return Boolean(staffRole && member.roles.cache.has(staffRole.id));
}

async function saveLastMessage(userId, timestamp) {
  // Só avança a data: nunca troca uma mensagem mais nova por uma mais antiga.
  await query(
    `INSERT INTO staff_activity (discord_id, last_message_at) VALUES ($1, $2)
     ON CONFLICT (discord_id) DO UPDATE
       SET last_message_at = GREATEST(staff_activity.last_message_at, EXCLUDED.last_message_at)`,
    [userId, new Date(timestamp)],
  );
}

// Lê as últimas mensagens de cada canal pra já começar com dados.
async function backfillFromRecentMessages(guild) {
  const latestByUser = new Map();
  const me = guild.members.me;

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      continue;
    }
    if (!me || !channel.permissionsFor(me)?.has(["ViewChannel", "ReadMessageHistory"])) {
      continue;
    }

    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      for (const message of messages.values()) {
        if (message.author.bot) continue;
        const previous = latestByUser.get(message.author.id) ?? 0;
        if (message.createdTimestamp > previous) {
          latestByUser.set(message.author.id, message.createdTimestamp);
        }
      }
    } catch (error) {
      console.warn(`Não consegui ler o histórico de #${channel.name}:`, error.message);
    }
  }

  for (const [userId, timestamp] of latestByUser) {
    await saveLastMessage(userId, timestamp);
  }
}

export async function trackStaffMessage(message) {
  if (!enabled || !message.inGuild() || message.author.bot || !isStaff(message.member)) {
    return;
  }

  const now = Date.now();
  if (now - (lastSavedAt.get(message.author.id) ?? 0) < SAVE_THROTTLE_MS) {
    return;
  }
  lastSavedAt.set(message.author.id, now);

  try {
    await saveLastMessage(message.author.id, message.createdTimestamp);
  } catch (error) {
    console.error("Não foi possível registrar a atividade do staff:", error);
  }
}

function formatInactiveLine(member, lastMessageAt) {
  const days = Math.floor((Date.now() - lastMessageAt.getTime()) / (24 * 60 * 60 * 1000));
  const unix = Math.floor(lastMessageAt.getTime() / 1000);
  return `• ${member} — ${days} dias sem mensagens (última: <t:${unix}:f>)`;
}

export async function sendStaffInactivityReport(client) {
  const channelId = getConfiguredChannelId("inatividadeStaff");

  if (!channelId) {
    console.warn("Canal do relatório de inatividade não configurado.");
    return;
  }

  const channel = await client.channels.fetch(channelId);
  const guild = channel.guild;
  const staffRole = findStaffRole(guild);

  if (!staffRole) {
    console.warn('Cargo "Equipe Administrativa" não encontrado; relatório não enviado.');
    return;
  }

  const members = await guild.members.fetch();
  const staff = members.filter((member) => !member.user.bot && member.roles.cache.has(staffRole.id));

  // Staff que nunca foi visto começa a contar a partir de agora,
  // pra ninguém ser acusado de inativo sem o bot ter observado.
  for (const member of staff.values()) {
    await query(
      `INSERT INTO staff_activity (discord_id, last_message_at) VALUES ($1, now())
       ON CONFLICT (discord_id) DO NOTHING`,
      [member.id],
    );
  }

  const result = await query(
    "SELECT discord_id, last_message_at FROM staff_activity WHERE discord_id = ANY($1)",
    [[...staff.keys()]],
  );
  const cutoff = Date.now() - INACTIVITY_LIMIT_MS;
  const inactive = result.rows
    .filter((row) => row.last_message_at.getTime() < cutoff)
    .sort((a, b) => a.last_message_at - b.last_message_at)
    .map((row) => formatInactiveLine(staff.get(row.discord_id), row.last_message_at));

  let description = inactive.length > 0
    ? inactive.join("\n")
    : "✅ Nenhum staff está inativo há mais de 2 dias.";

  if (description.length > 4000) {
    const shown = [];
    for (const line of inactive) {
      if (shown.join("\n").length + line.length > 3900) break;
      shown.push(line);
    }
    description = `${shown.join("\n")}\n… e mais ${inactive.length - shown.length}.`;
  }

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("📋 Relatório de inatividade da staff")
    .setDescription(description)
    .addFields(
      { name: "Staff no servidor", value: String(staff.size), inline: true },
      { name: "Inativos (+2 dias)", value: String(inactive.length), inline: true },
    )
    .setFooter({ text: "EB Zarkano • Inatividade da staff" })
    .setTimestamp();

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

function brasiliaDateKey(timestamp) {
  return new Date(timestamp + BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

async function sendDailyReportIfDue(client) {
  const now = new Date();
  if (now.getUTCHours() < REPORT_HOUR_UTC) {
    return;
  }

  const today = brasiliaDateKey(now.getTime());
  const result = await query("SELECT value FROM bot_state WHERE key = 'staff_report_date'");
  if (result.rows[0]?.value === today) {
    return;
  }

  // Marca antes de mandar, pra não repetir se o bot reiniciar no meio.
  await query(
    `INSERT INTO bot_state (key, value) VALUES ('staff_report_date', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [today],
  );
  await sendStaffInactivityReport(client);
  console.info("Relatório de inatividade da staff enviado.");
}

export async function startStaffActivityTracker(client) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS staff_activity (
        discord_id TEXT PRIMARY KEY,
        last_message_at TIMESTAMPTZ NOT NULL
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  } catch (error) {
    console.error("Relatório de inatividade desligado (banco indisponível):", error.message);
    return;
  }

  enabled = true;

  for (const guild of client.guilds.cache.values()) {
    try {
      await backfillFromRecentMessages(guild);
    } catch (error) {
      console.error(`Não consegui ler o histórico de ${guild.name}:`, error);
    }
  }

  const check = async () => {
    try {
      await sendDailyReportIfDue(client);
    } catch (error) {
      console.error("Erro no relatório de inatividade da staff:", error);
    }
  };

  check();
  setInterval(check, CHECK_INTERVAL_MS);
}
