import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfiguredChannelId } from "../config/channels.js";

const DATA_DIRECTORY = fileURLToPath(new URL("../../data/", import.meta.url));
const STATE_FILE = path.join(DATA_DIRECTORY, "moderation.json");

let moderationState = {
  disabledChannels: [],
  monitoredChannels: [],
  bypassRoleIds: [],
  logChannelId: null,
  protectionModeByGuild: {},
};
let loaded = false;

async function loadState() {
  if (loaded) {
    return;
  }

  try {
    const content = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(content);
    moderationState = {
      ...moderationState,
      ...parsed,
      disabledChannels: Array.isArray(parsed.disabledChannels)
        ? parsed.disabledChannels
        : [],
      monitoredChannels: Array.isArray(parsed.monitoredChannels)
        ? parsed.monitoredChannels
        : [],
      bypassRoleIds: Array.isArray(parsed.bypassRoleIds)
        ? parsed.bypassRoleIds
        : [],
      protectionModeByGuild:
        parsed.protectionModeByGuild &&
        typeof parsed.protectionModeByGuild === "object"
          ? parsed.protectionModeByGuild
          : {},
    };
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
      moderationState,
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function isModerationDisabled(channelId) {
  await loadState();
  return moderationState.disabledChannels.includes(channelId);
}

export async function disableModeration(channelId) {
  await loadState();
  if (!moderationState.disabledChannels.includes(channelId)) {
    moderationState.disabledChannels.push(channelId);
  }
  await saveState();
}

export async function enableModeration(channelId) {
  await loadState();
  moderationState.disabledChannels = moderationState.disabledChannels.filter(
    (id) => id !== channelId,
  );
  await saveState();
}

export async function getModerationSettings() {
  await loadState();
  return structuredClone(moderationState);
}

export async function setMonitoredChannel(channelId) {
  await loadState();
  if (!moderationState.monitoredChannels.includes(channelId)) {
    moderationState.monitoredChannels.push(channelId);
  }
  await saveState();
}

export async function clearMonitoredChannels() {
  await loadState();
  moderationState.monitoredChannels = [];
  await saveState();
}

export async function setModerationLogChannel(channelId) {
  await loadState();
  moderationState.logChannelId = channelId;
  await saveState();
}

export async function getModerationLogChannelId() {
  await loadState();
  return moderationState.logChannelId || getConfiguredChannelId("logs");
}

export async function setBypassRole(roleId, enabled) {
  await loadState();
  const roles = new Set(moderationState.bypassRoleIds);

  if (enabled) {
    roles.add(roleId);
  } else {
    roles.delete(roleId);
  }

  moderationState.bypassRoleIds = [...roles];
  await saveState();
}

export async function isModerationIgnored(message) {
  await loadState();

  if (moderationState.disabledChannels.includes(message.channel.id)) {
    return true;
  }

  if (
    moderationState.monitoredChannels.length > 0 &&
    !moderationState.monitoredChannels.includes(message.channel.id)
  ) {
    return true;
  }

  return moderationState.bypassRoleIds.some((roleId) =>
    message.member?.roles?.cache?.has(roleId),
  );
}

export async function setProtectionMode(guildId, enabled) {
  await loadState();

  if (enabled) {
    moderationState.protectionModeByGuild[guildId] = true;
  } else {
    delete moderationState.protectionModeByGuild[guildId];
  }

  await saveState();
}

export async function isProtectionModeEnabled(guildId) {
  await loadState();
  return Boolean(moderationState.protectionModeByGuild[guildId]);
}