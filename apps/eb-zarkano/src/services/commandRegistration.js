import { REST, Routes } from "discord.js";
import { commands } from "../commands/index.js";

// Registra (ou atualiza) os comandos de barra no Discord. Roda sozinho
// toda vez que o bot liga, então comando novo aparece sem fazer nada.
export async function registerSlashCommands(clientId, token) {
  const commandPayload = [...commands.values()].map((command) =>
    command.data.toJSON(),
  );
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), {
    body: commandPayload,
  });

  return commandPayload.length;
}
