import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIRECTORY = fileURLToPath(new URL("../../data/", import.meta.url));
const STATE_FILE = path.join(DATA_DIRECTORY, "moderation.json");

let disabledChannels = new Set();
let loaded = false;

async function loadState() {
  if (loaded) {
    return;
  }

  try {
    const content = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(content);
    disabledChannels = new Set(
      Array.isArray(parsed.disabledChannels) ? parsed.disabledChannels : [],
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Não foi possível carregar o estado da moderação:", error);
    }
  }

  loaded = true;
}

async function saveState() {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(
    STATE_FILE,
    `${JSON.stringify(
      { disabledChannels: [...disabledChannels] },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function isModerationDisabled(channelId) {
  await loadState();
  return disabledChannels.has(channelId);
}

export async function disableModeration(channelId) {
  await loadState();
  disabledChannels.add(channelId);
  await saveState();
}

export async function enableModeration(channelId) {
  await loadState();
  disabledChannels.delete(channelId);
  await saveState();
}