import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "./commands/index.js";
import { getConfig } from "./config.js";
import { handleGuildMemberAdd } from "./events/guildMemberAdd.js";
import { handleWelcomeButton } from "./handlers/welcomeButtons.js";

const { token } = getConfig();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (readyClient) => {
  console.info(`EB Zarkano conectado como ${readyClient.user.tag}.`);
});

client.on(Events.GuildMemberAdd, handleGuildMemberAdd);

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      await handleWelcomeButton(interaction);
    } catch (error) {
      console.error("Erro ao processar botão da mensagem de boas-vindas:", error);

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

await client.login(token);