import { robloxGroupId } from "../config/roblox.js";

const ROLES_CACHE_MS = 5 * 60 * 1000; // 5 minutos
let rolesCache = { roles: null, expiresAt: 0 };

// Patentes do grupo pela Open Cloud API v2 (com cache de 5 minutos).
export async function fetchGroupRoles(apiKey) {
  if (rolesCache.roles && Date.now() < rolesCache.expiresAt) {
    return rolesCache.roles;
  }

  const roles = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://apis.roblox.com/cloud/v2/groups/${robloxGroupId}/roles`,
    );
    url.searchParams.set("maxPageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, { headers: { "x-api-key": apiKey } });

    if (!response.ok) {
      throw new Error(
        `Falha ao consultar cargos do grupo (status ${response.status}).`,
      );
    }

    const data = await response.json();
    roles.push(...(data.groupRoles ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  rolesCache = { roles, expiresAt: Date.now() + ROLES_CACHE_MS };
  return roles;
}

// Patente atual do jogador no grupo, ou null se ele não estiver no grupo.
export async function fetchMemberGroupRole(apiKey, robloxUserId) {
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
  const membership = data.groupMemberships?.[0];

  if (!membership) {
    return null;
  }

  const roleId = membership.role?.split("/").pop();
  const roles = await fetchGroupRoles(apiKey);
  return roles.find((role) => role.id === roleId) ?? null;
}
