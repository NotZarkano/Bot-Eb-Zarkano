import { PermissionFlagsBits } from "discord.js";
import { getConfig } from "../config.js";
import { getConfiguredRoleId } from "../config/roles.js";
import { buildNickname, normalizeRankName } from "../utils/rankNames.js";
import { findDiscordLink, LinkSystemInactiveError } from "./database.js";
import { fetchGroupRoles, fetchMemberGroupRole } from "./robloxGroup.js";

const SYNC_COOLDOWN_MS = 20 * 1000; // 20 segundos por pessoa
const lastSyncByUser = new Map();

const SITE_URL = "https://ebzarkano.onrender.com";

function isAdministratorRole(role) {
  return role.permissions.has(PermissionFlagsBits.Administrator);
}

// Retorna quantos segundos faltam, ou 0 se já pode sincronizar.
function checkCooldown(userId) {
  const now = Date.now();
  const last = lastSyncByUser.get(userId) ?? 0;
  const remaining = SYNC_COOLDOWN_MS - (now - last);

  if (remaining > 0) {
    return Math.ceil(remaining / 1000);
  }

  lastSyncByUser.set(userId, now);

  // Limpa entradas antigas pra o mapa não crescer pra sempre.
  for (const [id, time] of lastSyncByUser) {
    if (now - time > SYNC_COOLDOWN_MS) {
      lastSyncByUser.delete(id);
    }
  }

  return 0;
}

// Cargos do Discord que representam patentes do grupo (mesmo nome, sem
// sigla e sem acento). Membro, Membro Certificado e Staff nunca entram.
function findRankRoles(guild, groupRoles) {
  const groupRankNames = new Set(
    groupRoles
      .filter((role) => Number(role.rank) > 0)
      .map((role) => normalizeRankName(role.displayName))
      .filter(Boolean),
  );
  const protectedRoleIds = new Set(
    [
      getConfiguredRoleId("membro"),
      getConfiguredRoleId("membroCertificado"),
      getConfiguredRoleId("staff"),
    ].filter(Boolean),
  );

  return guild.roles.cache.filter(
    (role) =>
      role.id !== guild.id &&
      !role.managed &&
      !protectedRoleIds.has(role.id) &&
      groupRankNames.has(normalizeRankName(role.name)),
  );
}

export async function syncMember(interaction) {
  const remaining = checkCooldown(interaction.user.id);

  if (remaining > 0) {
    await interaction.reply({
      content: `⏳ Aguarde **${remaining}s** para sincronizar de novo.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  let link;

  try {
    link = await findDiscordLink(interaction.user.id);
  } catch (error) {
    if (error instanceof LinkSystemInactiveError) {
      await interaction.editReply({
        content:
          "⚠️ O sistema de vínculo ainda não está ativo. Tente novamente mais tarde.",
      });
      return;
    }
    throw error;
  }

  if (!link) {
    await interaction.editReply({
      content: [
        "🔗 Seu Discord ainda não está vinculado a uma conta do Roblox.",
        `Entre em ${SITE_URL} com o Roblox, clique em **Vincular Discord** no seu perfil e depois volte aqui.`,
      ].join("\n"),
    });
    return;
  }

  const { robloxApiKey } = getConfig();

  if (!robloxApiKey) {
    await interaction.editReply({
      content:
        "⚠️ A integração com o Roblox ainda não foi configurada. Avise a equipe.",
    });
    return;
  }

  const robloxUsername = link.robloxUsername || link.robloxId;
  const [groupRole, groupRoles] = await Promise.all([
    fetchMemberGroupRole(robloxApiKey, link.robloxId),
    fetchGroupRoles(robloxApiKey),
  ]);

  if (!groupRole) {
    await interaction.editReply({
      content: `❌ A conta **${robloxUsername}** não está no grupo do EB Zarkano no Roblox. Entre no grupo e tente de novo.`,
    });
    return;
  }

  const guild = interaction.guild;
  await guild.roles.fetch();
  const member = await guild.members.fetch(interaction.user.id);

  const rankRoles = findRankRoles(guild, groupRoles);
  const targetName = normalizeRankName(groupRole.displayName);
  const targetRole = rankRoles.find(
    (role) => normalizeRankName(role.name) === targetName,
  );

  const toRemove = [];
  const toAdd = [];
  const warnings = [];

  for (const role of member.roles.cache.values()) {
    if (!rankRoles.has(role.id) || role.id === targetRole?.id) {
      continue;
    }
    if (isAdministratorRole(role)) {
      continue;
    }
    if (!role.editable) {
      warnings.push(`Não consegui tirar o cargo **${role.name}** (está acima do bot).`);
      continue;
    }
    toRemove.push(role);
  }

  if (!targetRole) {
    warnings.push(
      `Não encontrei no Discord um cargo com o nome da patente **${groupRole.displayName}**.`,
    );
  } else if (!member.roles.cache.has(targetRole.id)) {
    if (isAdministratorRole(targetRole)) {
      warnings.push(
        `O cargo **${targetRole.name}** tem permissão de Administrador, então o bot não entrega. Peça a um administrador.`,
      );
    } else if (!targetRole.editable) {
      warnings.push(`Não consegui dar o cargo **${targetRole.name}** (está acima do bot).`);
    } else {
      toAdd.push(targetRole);
    }
  }

  const membroRoleId = getConfiguredRoleId("membro");
  const membroCertificadoRoleId = getConfiguredRoleId("membroCertificado");
  const hasMemberRole =
    (membroRoleId && member.roles.cache.has(membroRoleId)) ||
    (membroCertificadoRoleId && member.roles.cache.has(membroCertificadoRoleId));

  if (membroRoleId && !hasMemberRole) {
    const membroRole = guild.roles.cache.get(membroRoleId);

    if (!membroRole) {
      warnings.push("O cargo Membro configurado não existe mais no servidor.");
    } else if (isAdministratorRole(membroRole)) {
      warnings.push("O cargo Membro tem permissão de Administrador, então o bot não entrega.");
    } else if (!membroRole.editable) {
      warnings.push(`Não consegui dar o cargo **${membroRole.name}** (está acima do bot).`);
    } else {
      toAdd.push(membroRole);
    }
  }

  const reason = `Sincronização Roblox (${robloxUsername})`;

  if (toRemove.length > 0) {
    await member.roles.remove(toRemove, reason);
  }
  if (toAdd.length > 0) {
    await member.roles.add(toAdd, reason);
  }

  const nickname = buildNickname(groupRole.displayName, robloxUsername);
  let nicknameChanged = false;

  if (member.nickname !== nickname) {
    if (member.id === guild.ownerId) {
      warnings.push(
        `Não posso mudar o apelido do dono do servidor. Coloque manualmente: \`${nickname}\``,
      );
    } else if (!member.manageable) {
      warnings.push(
        `Não consegui mudar seu apelido porque seu cargo está acima do bot. Apelido certo: \`${nickname}\``,
      );
    } else {
      try {
        await member.setNickname(nickname, reason);
        nicknameChanged = true;
      } catch (error) {
        console.error("Não foi possível mudar o apelido na sincronização:", error);
        warnings.push(`Não consegui mudar seu apelido. Apelido certo: \`${nickname}\``);
      }
    }
  }

  const lines = [
    `✅ Sincronizado com **${robloxUsername}** — patente **${groupRole.displayName}**.`,
  ];

  if (toAdd.length > 0) {
    lines.push(`➕ Cargos recebidos: ${toAdd.map((role) => role.name).join(", ")}`);
  }
  if (toRemove.length > 0) {
    lines.push(`➖ Cargos removidos: ${toRemove.map((role) => role.name).join(", ")}`);
  }
  if (nicknameChanged) {
    lines.push(`🪪 Apelido: \`${nickname}\``);
  }
  if (toAdd.length === 0 && toRemove.length === 0 && !nicknameChanged && warnings.length === 0) {
    lines.push("Tudo já estava certo, nada mudou.");
  }
  if (warnings.length > 0) {
    lines.push("", ...warnings.map((warning) => `⚠️ ${warning}`));
  }

  await interaction.editReply({ content: lines.join("\n") });
}
