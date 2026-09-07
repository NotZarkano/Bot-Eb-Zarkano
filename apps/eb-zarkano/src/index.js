import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "./commands/index.js";
import { getConfig } from "./config.js";
import { handleGuildMemberAdd } from "./events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./events/guildMemberRemove.js";
import { handleAnnounceModal } from "./handlers/announceModal.js";
import { handleInformationButton } from "./handlers/informationButtons.js";
import { handleTicketButton } from "./handlers/ticketButtons.js";
import { handleVerificationButton } from "./handlers/verificationButtons.js";
import { handleWelcomeButton } from "./handlers/welcomeButtons.js";
import { startKeepAliveServer } from "./keepAlive.js";
import {
  enforceRoleExclusivity,
  startMembershipProgressionScheduler,
} from "./services/membershipProgression.js";
import { ensureInformationPanel } from "./services/informationSystem.js";
import { ensureTicketPanel } from "./services/ticketSystem.js";
import { ensureVerificationPanel } from "./services/verificationSystem.js";

const { token } = getConfig();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.info(`EB Zarkano conectado como ${readyClient.user.tag}.`);

  try {
    await ensureTicketPanel(readyClient);
  } catch (error) {
    console.error("Não foi possível preparar o painel de tickets:", error);
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

  startMembershipProgressionScheduler(readyClient);
});

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

      const verificationButtonHandled = await handleVerificationButton(interaction);

      if (verificationButtonHandled) {
        return;
      }

      await handleTicketButton(interaction);
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

startKeepAliveServer();

await client.login(token);
