import { getConfiguredRoleId } from "../config/roles.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const CERTIFICATION_DELAY_MS = 24 * 60 * 60 * 1000; // 1 dia

export async function enforceRoleExclusivity(member) {
  const membroRoleId = getConfiguredRoleId("membro");
  const membroCertificadoRoleId = getConfiguredRoleId("membroCertificado");

  if (!membroRoleId || !membroCertificadoRoleId) {
    return;
  }

  const hasBoth =
    member.roles.cache.has(membroRoleId) &&
    member.roles.cache.has(membroCertificadoRoleId);

  if (!hasBoth) {
    return;
  }

  try {
    await member.roles.remove(
      membroRoleId,
      "Membro certificado não deve manter o cargo de membro comum",
    );
  } catch (error) {
    console.error(
      "Não foi possível remover o cargo de membro duplicado:",
      error,
    );
  }
}

async function upgradeEligibleMembers(guild) {
  const membroRoleId = getConfiguredRoleId("membro");
  const membroCertificadoRoleId = getConfiguredRoleId("membroCertificado");

  if (!membroRoleId || !membroCertificadoRoleId) {
    return;
  }

  let members;

  try {
    members = await guild.members.fetch();
  } catch (error) {
    console.error(
      `Não foi possível buscar os membros do servidor ${guild.name}:`,
      error,
    );
    return;
  }

  const now = Date.now();

  for (const member of members.values()) {
    if (member.user.bot) {
      continue;
    }

    const hasMembro = member.roles.cache.has(membroRoleId);
    const hasMembroCertificado = member.roles.cache.has(
      membroCertificadoRoleId,
    );

    if (hasMembro && hasMembroCertificado) {
      await enforceRoleExclusivity(member);
      continue;
    }

    if (!hasMembro || hasMembroCertificado) {
      continue;
    }

    const joinedAt = member.joinedTimestamp;

    if (!joinedAt || now - joinedAt < CERTIFICATION_DELAY_MS) {
      continue;
    }

    try {
      await member.roles.add(
        membroCertificadoRoleId,
        "1 dia completo como membro",
      );
      await member.roles.remove(
        membroRoleId,
        "Promovido para membro certificado",
      );
      console.info(
        `${member.user.tag} promovido para membro certificado em ${guild.name}.`,
      );
    } catch (error) {
      console.error(
        `Não foi possível promover ${member.user.tag} para membro certificado:`,
        error,
      );
    }
  }
}

export function startMembershipProgressionScheduler(client) {
  const runCheck = async () => {
    for (const guild of client.guilds.cache.values()) {
      await upgradeEligibleMembers(guild);
    }
  };

  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}
