import { PermissionFlagsBits } from "discord.js";
import { getConfiguredRoleId } from "../config/roles.js";

// Todo mundo que está no servidor tem o cargo Membro.
function getMemberRole(guild) {
  const roleId = getConfiguredRoleId("membro");
  const role = roleId ? guild.roles.cache.get(roleId) : null;

  if (!role) {
    console.warn("Cargo Membro não encontrado. Confira roleIds.membro em src/config/roles.js.");
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
