import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIRECTORY = fileURLToPath(new URL("../../data/", import.meta.url));
const HISTORY_FILE = path.join(DATA_DIRECTORY, "infractions.json");
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_EVENTS_PER_USER = 100;

let history = {};
let loaded = false;
let writeQueue = Promise.resolve();

async function loadHistory() {
  if (loaded) {
    return;
  }

  try {
    history = JSON.parse(await readFile(HISTORY_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Não foi possível carregar o histórico de infrações:", error);
    }
  }

  loaded = true;
}

async function saveHistory() {
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIRECTORY, { recursive: true });
    await writeFile(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  });

  return writeQueue;
}

function getKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getActiveEvents(events, now = Date.now()) {
  return events.filter((event) => now - event.timestamp <= HISTORY_WINDOW_MS);
}

export async function recordInfraction({
  guildId,
  userId,
  channelId,
  category,
  score,
  action,
}) {
  await loadHistory();
  const key = getKey(guildId, userId);
  const events = getActiveEvents(history[key] ?? []);
  const event = {
    timestamp: Date.now(),
    channelId,
    category,
    score,
    action,
  };

  history[key] = [...events, event].slice(-MAX_EVENTS_PER_USER);
  await saveHistory();

  return {
    occurrence: history[key].length,
    events: [...history[key]],
  };
}

export async function getUserInfractions(guildId, userId) {
  await loadHistory();
  const key = getKey(guildId, userId);
  const events = getActiveEvents(history[key] ?? []);
  history[key] = events;
  return [...events];
}

export async function clearUserInfractions(guildId, userId) {
  await loadHistory();
  delete history[getKey(guildId, userId)];
  await saveHistory();
}