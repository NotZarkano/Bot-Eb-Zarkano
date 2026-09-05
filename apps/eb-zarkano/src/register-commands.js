import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { getConfig } from "./config.js";

const { clientId, token } = getConfig();
const commandPayload = [...commands.values()].map((command) =>
  command.data.toJSON(),
);
const rest = new REST({ version: "10" }).setToken(token);

await rest.put(Routes.applicationCommands(clientId), {
  body: commandPayload,
});

console.info(
  `${commandPayload.length} comando(s) slash registrado(s) para o EB Zarkano.`,
);