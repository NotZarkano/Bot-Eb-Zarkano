import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { robloxGroupId } from "../config/roblox.js";

const EB_ZARKANO_GREEN = 0x8fc63f;
const USERNAME_LOOKUP_URL = "https://users.roblox.com/v1/usernames/users";

export const data = new SlashCommandBuilder()
  .setName("patente")
  .setDescription("Mostra a patente de um usuário no grupo do Roblox.")
  .addStringOption((option) =>
    option
      .setName("usuario")
      .setDescription("Nome de usuário no Roblox")
      .setRequired(true),
  );

async function resolveRobloxUser(username) {
  const response = await fetch(USERNAME_LOOKUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar usuário no Roblox (status ${response.status}).`,
    );
  }

  const data = await response.json();
  return data.data?.[0] ?? null;
}

async function fetchGroupRoles(apiKey) {
  const response = await fetch(
    `https://apis.roblox.com/cloud/v2/groups/${robloxGroupId}/roles?maxPageSize=100`,
    { headers: { "x-api-key": apiKey } },
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar cargos do grupo (status ${response.status}).`,
    );
  }

  const data = await response.json();
  return data.groupRoles ?? [];
}

async function fetchMembership(apiKey, robloxUserId) {
  const filter = encodeURIComponent(`user=='users/${robloxUserId}'`);
  const response = await fetch(
    `https://apis.roblox.com/cloud/v2/groups/${robloxGroupId}/memberships?maxPageSize=1&filter=${filter}`,
    { headers: { "x-api-key": apiKey } },
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar associação ao grupo (status ${response.status}).`,
    );
  }

  const data = await response.json();
  return data.groupMemberships?.[0] ?? null;
}

export async function execute(interaction) {
  const { robloxApiKey } = getConfig();

  if (!robloxApiKey) {
    await interaction.reply({
      content:
        "A integração com o Roblox ainda não foi configurada. Defina ROBLOX_OPEN_CLOUD_API_KEY nas variáveis de ambiente do bot.",
      ephemeral: true,
    });
    return;
  }

  const username = interaction.options.getString("usuario", true);

  await interaction.deferReply();

  try {
    const robloxUser = await resolveRobloxUser(username);

    if (!robloxUser) {
      await interaction.editReply({
        content: `Não encontrei nenhum usuário do Roblox com o nome **${username}**.`,
      });
      return;
    }

    const membership = await fetchMembership(robloxApiKey, robloxUser.id);

    if (!membership) {
      await interaction.editReply({
        content: `**${robloxUser.name}** não é membro do grupo EB Zarkano no Roblox.`,
      });
      return;
    }

    const roleId = membership.role?.split("/").pop();
    const roles = await fetchGroupRoles(robloxApiKey);
    const role = roles.find((groupRole) => groupRole.id === roleId);

    const embed = new EmbedBuilder()
      .setColor(EB_ZARKANO_GREEN)
      .setTitle(`🪖 Patente de ${robloxUser.name}`)
      .setThumbnail(
        `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUser.id}&width=150&height=150&format=png`,
      )
      .addFields(
        {
          name: "Usuário",
          value: robloxUser.displayName || robloxUser.name,
          inline: true,
        },
        {
          name: "Patente",
          value: role?.displayName ?? "Cargo não encontrado",
          inline: true,
        },
      )
      .setFooter({ text: "EB Zarkano • Grupo do Roblox" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao consultar patente no Roblox:", error);
    await interaction.editReply({
      content:
        "Não foi possível consultar a patente agora. Tente novamente em instantes.",
    });
  }
}
