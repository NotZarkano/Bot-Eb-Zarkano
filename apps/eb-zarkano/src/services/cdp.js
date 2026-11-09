import { query } from "./database.js";

// CDP (Capacitação de Patente). A regra é a MESMA do site (repo
// Site-EB-Zarkano, arquivo cdp.js), e os dois usam as mesmas tabelas
// (cdp_patente e site_config). Se mudar os tempos lá, mude aqui também.
const CDP_HOURS = [
  ["General de Exército", 110],
  ["General de Divisão", 105],
  ["General de Brigada", 100],
  ["Coronel", 85],
  ["Tenente Coronel", 80],
  ["Major", 75],
  ["Capitão", 65],
  ["Primeiro Tenente", 55],
  ["Segundo Tenente", 50],
  ["Aspirante a Oficial", 45],
  ["Cadete", 35],
  ["Subtenente", 30],
  ["Primeiro Sargento", 25],
  ["Segundo Sargento", 20],
  ["Terceiro Sargento", 15],
  ["Cabo", 12],
  ["Soldado", 6],
  ["Recruta", 3],
];

// Igual ao site: tira a sigla "[XX]", acentos e símbolos.
function normalizeCdpName(name) {
  return (name ?? "")
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Gamepass VIP: quem tem faz só METADE do tempo (mesmo número do site).
// https://www.roblox.com/game-pass/2054232226/VIP
const VIP_GAMEPASS_ID = 2054232226;

// Cache: tem VIP -> 6 horas; não tem -> 5 minutos (pode ter acabado de comprar).
const vipCache = new Map();

async function hasVip(robloxId) {
  const cached = vipCache.get(String(robloxId));
  if (cached && Date.now() < cached.expiresAt) return cached.vip;
  try {
    const response = await fetch(
      `https://inventory.roblox.com/v1/users/${robloxId}/items/1/${VIP_GAMEPASS_ID}/is-owned`,
    );
    if (!response.ok) throw new Error(`status ${response.status}`);
    const vip = (await response.json()) === true;
    vipCache.set(String(robloxId), {
      vip,
      expiresAt: Date.now() + (vip ? 6 * 60 : 5) * 60 * 1000,
    });
    return vip;
  } catch (error) {
    console.error("Não consegui conferir o VIP da CDP:", error.message);
    return cached ? cached.vip : false;
  }
}

const HOURS_BY_RANK = new Map(
  CDP_HOURS.map(([name, hours]) => [normalizeCdpName(name), hours]),
);

export function getCdpHours(rankName) {
  return HOURS_BY_RANK.get(normalizeCdpName(rankName)) ?? null;
}

async function getCdpStart() {
  const result = await query("SELECT valor FROM site_config WHERE chave = 'cdp_inicio'");
  return new Date(result.rows[0]?.valor || Date.now());
}

// Desde quando o jogador está na patente atual (mesma lógica do site).
async function getSinceInRank(robloxId, roleId) {
  const result = await query(
    "SELECT role_id, desde FROM cdp_patente WHERE user_id = $1",
    [robloxId],
  );
  const row = result.rows[0];

  if (row && String(row.role_id) === String(roleId)) {
    return new Date(row.desde);
  }

  const since = row ? new Date() : await getCdpStart();
  await query(
    `INSERT INTO cdp_patente (user_id, role_id, desde) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, desde = EXCLUDED.desde`,
    [robloxId, roleId, since],
  );
  return since;
}

// Situação da CDP. `groupRole` vem da Open Cloud ({ id, displayName }).
export async function getCdpStatus(robloxId, groupRole) {
  const normalHours = getCdpHours(groupRole.displayName);

  if (normalHours === null) {
    return { hasCdp: false };
  }

  const vip = await hasVip(robloxId);
  const hours = vip ? normalHours / 2 : normalHours;

  const since = await getSinceInRank(robloxId, groupRole.id);
  const totalMs = hours * 60 * 60 * 1000;
  const releaseAt = new Date(since.getTime() + totalMs);
  const remainingMs = Math.max(0, releaseAt.getTime() - Date.now());

  return {
    hasCdp: true,
    inCdp: remainingMs > 0,
    hours,
    vip,
    since,
    releaseAt,
    remainingMs,
    progress: Math.min(1, (totalMs - remainingMs) / totalMs),
  };
}
