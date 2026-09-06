import {
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getConfiguredChannelId } from "../config/channels.js";

const FAREWELL_BANNER_NAME = "F33AD00F-BF15-4D0C-9462-5C8902FFF0BF.png";
const FAREWELL_BANNER_PATH = fileURLToPath(
  new URL(`../../assets/${FAREWELL_BANNER_NAME}`, import.meta.url),
);
const EB_ZARKANO_RED = 0xe74c3c;

function getMemberDisplayName(member) {
  return (
    member.user?.globalName ||
    member.user?.username ||
    member.displayName ||
    "um membro"
  );
}

function createFarewellPayload(member) {
  const memberName = getMemberDisplayName(member);

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_RED)
    .setTitle(`🚪 Até logo, ${memberName}!`)
    .setDescription(
      [
        `**${memberName}** acabou de deixar a comunidade do **Exército Brasileiro — EB Zarkano**.`,
        "",
        "Obrigado por ter feito parte do nosso servidor. Se precisar voltar, será sempre bem-vindo(a)!",
      ].join("\n"),
    )
    .setThumbnail(
      member.user?.displayAvatarURL({ extension: "png", size: 256 }) ?? null,
    )
    .setImage(`attachment://${FAREWELL_BANNER_NAME}`)
    .setFooter({ text: "EB Zarkano • Até logo" })
    .setTimestamp();

  const banner = new AttachmentBuilder(FAREWELL_BANNER_PATH, {
    name: FAREWELL_BANNER_NAME,
  });

  return {
    embeds: [embed],
    files: [banner],
  };
}

export async function sendFarewellMessage({ guild, member }) {
  const welcomeChannelId = getConfiguredChannelId("boasVindas");

  if (!welcomeChannelId) {
    return {
      sent: false,
      reason:
        "O canal de boas-vindas ainda não foi configurado em src/config/channels.js.",
    };
  }

  if (!existsSync(FAREWELL_BANNER_PATH)) {
    return {
      sent: false,
      reason: `O banner obrigatório não foi encontrado em ${FAREWELL_BANNER_PATH}.`,
    };
  }

  const farewellChannel = await guild.channels.fetch(welcomeChannelId);

  if (!farewellChannel || typeof farewellChannel.send !== "function") {
    return {
      sent: false,
      reason:
        "O canal configurado para boas-vindas não é um canal de texto válido.",
    };
  }

  await farewellChannel.send(createFarewellPayload(member));

  return { sent: true };
}
