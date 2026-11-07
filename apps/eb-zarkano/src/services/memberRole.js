import { PermissionFlagsBits } from "discord.js";
import { getConfiguredRoleId } from "../config/roles.js";
import { normalizeRankName } from "../utils/rankNames.js";

// Acha o cargo Membro: primeiro pelo ID de src/config/roles.js e, se ele não
// existir mais (cargo apagado e criado de novo), pelo nome "Membro".
export function findMemberRole(guild) {
  const roleId = getConfiguredRoleId("membro");
  return (
    (roleId && guild.roles.cache.get(roleId)) ||
    guild.roles.cache.find((role) => normalizeRankName(role.name) === "membro") ||
    null
  );
}

// Todo mundo que está no servidor tem o cargo Membro.
function getMemberRole(guild) {
  const role = findMemberRole(guild);

  if (!role) {
    console.warn('Cargo "Membro" não encontrado no servidor. Crie um cargo com esse nome.');
    return null;
  }
  if (role.permissions.has(PermissionFlagsBits.Administrator) || !role.editable) {
    console.warn(`O bot não consegue entregar o cargo ${role.name} (Administrador ou acima do bot).`);
    return null;
  }
  return role;
}

// Quem acabou de entrar recebe o Membro.
export async function giveMemberRole(member) {
  if (member.user.bot) return;
  const role = getMemberRole(member.guild);
  if (!role || member.roles.cache.has(role.id)) return;
  await member.roles.add(role, "Entrou no servidor");
}

// Ao ligar: dá o Membro a todo mundo que ainda não tem.
export async function giveMemberRoleToEveryone(client) {
  for (const guild of client.guilds.cache.values()) {
    const role = getMemberRole(guild);
    if (!role) continue;

    const members = await guild.members.fetch();
    let given = 0;
    for (const member of members.values()) {
      if (member.user.bot || member.roles.cache.has(role.id)) continue;
      try {
        await member.roles.add(role, "Todo membro do servidor tem o cargo Membro");
        given++;
      } catch (error) {
        console.error(`Não consegui dar o Membro para ${member.user.tag}:`, error.message);
      }
    }
    if (given > 0) {
      console.info(`Cargo Membro entregue para ${given} pessoa(s) em ${guild.name}.`);
    }
  }
}
