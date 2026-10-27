import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "./commands/index.js";
import { getConfig } from "./config.js";
import { handleGuildMemberAdd } from "./events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./events/guildMemberRemove.js";
import { handleAnnounceModal } from "./handlers/announceModal.js";
import { handleInformationButton } from "./handlers/informationButtons.js";
import { handleVerificationButton } from "./handlers/verificationButtons.js";
import { handleWelcomeButton } from "./handlers/welcomeButtons.js";
import { shouldStartKeepAlive, startKeepAliveServer } from "./keepAlive.js";
import { registerSlashCommands } from "./services/commandRegistration.js";
import {
  enforceRoleExclusivity,
  startMembershipProgressionScheduler,
} from "./services/membershipProgression.js";
import { ensureInformationPanel } from "./services/informationSystem.js";
import {
  ensurePingPanel,
  handlePingButton,
  schedulePingPanelRefresh,
  schedulePingPanelRefreshNow,
} from "./services/pingPanel.js";
import { removeLegacyTicketPanel } from "./services/legacyCleanup.js";
import { startStaffActivityTracker, trackStaffMessage } from "./services/staffActivity.js";
import { ensureVerificationPanel } from "./services/verificationSystem.js";

const { token, clientId } = getConfig();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.info(`EB Zarkano conectado como ${readyClient.user.tag}.`);

  try {
    const total = await registerSlashCommands(clientId, token);
    console.info(`${total} comando(s) slash registrado(s).`);
  } catch (error) {
    console.error("Não foi possível registrar os comandos de barra:", error);
  }

  try {
    await removeLegacyTicketPanel(readyClient);
  } catch (error) {
    console.error("Não foi possível apagar o painel antigo de tickets:", error);
  }

  try {
    await ensureInformationPanel(readyClient);
  } catch (error) {
    console.error("Não foi possível preparar o painel de informações:", error);
  }

  try {
    await ensureVerificationPanel(readyClient);
  } catch (error) {
    console.error("Não foi possível preparar o painel de verificação:", error);
  }

  try {
    await ensurePingPanel(readyClient);
  } catch (error) {
    console.error("Não foi possível preparar o painel de pings:", error);
  }

  startMembershipProgressionScheduler(readyClient);
  startStaffActivityTracker(readyClient);
});

client.on(Events.MessageCreate, trackStaffMessage);

client.on(Events.GuildRoleCreate, (role) => schedulePingPanelRefresh(client, role));
client.on(Events.GuildRoleUpdate, (oldRole, newRole) => schedulePingPanelRefresh(client, oldRole, newRole));
client.on(Events.GuildRoleDelete, (role) => schedulePingPanelRefresh(client, role));
client.on(Events.GuildEmojiCreate, () => schedulePingPanelRefreshNow(client));
client.on(Events.GuildEmojiUpdate, () => schedulePingPanelRefreshNow(client));
client.on(Events.GuildEmojiDelete, () => schedulePingPanelRefreshNow(client));

client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
client.on(Events.GuildMemberRemove, handleGuildMemberRemove);

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    await enforceRoleExclusivity(newMember);
  } catch (error) {
    console.error("Não foi possível reforçar a exclusividade de cargos:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isModalSubmit()) {
    try {
      const handled = await handleAnnounceModal(interaction);

      if (!handled) {
        console.warn(`Modal não tratado: ${interaction.customId}`);
      }
    } catch (error) {
      console.error("Erro ao processar formulário:", error);

      const response = {
        content: "Não foi possível processar esse formulário agora.",
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      const welcomeButtonHandled = await handleWelcomeButton(interaction);

      if (welcomeButtonHandled) {
        return;
      }

      const informationButtonHandled = await handleInformationButton(interaction);

      if (informationButtonHandled) {
        return;
      }

      const pingButtonHandled = await handlePingButton(interaction);

      if (pingButtonHandled) {
        return;
      }

      const verificationButtonHandled = await handleVerificationButton(interaction);

      if (verificationButtonHandled) {
        return;
      }

      // Botões que não existem mais (ex.: os do sistema de tickets antigo).
      await interaction.reply({
        content: "Esse botão foi desativado.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erro ao processar botão interativo:", error);

      const response = {
        content: "Não foi possível processar esse botão agora.",
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "Esse comando ainda não está disponível.",
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);

    const response = {
      content: "Não consegui executar esse comando agora.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Erro no cliente do Discord:", error);
});

process.on("SIGINT", () => {
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});

if (shouldStartKeepAlive()) {
  startKeepAliveServer();
}

await client.login(token);
