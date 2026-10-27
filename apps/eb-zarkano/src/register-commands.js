import { getConfig } from "./config.js";
import { registerSlashCommands } from "./services/commandRegistration.js";

const { clientId, token } = getConfig();
const total = await registerSlashCommands(clientId, token);

console.info(`${total} comando(s) slash registrado(s) para o EB Zarkano.`);
