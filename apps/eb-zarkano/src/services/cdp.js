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
  const hours = getCdpHours(groupRole.displayName);

  if (hours === null) {
    return { hasCdp: false };
  }

  const since = await getSinceInRank(robloxId, groupRole.id);
  const totalMs = hours * 60 * 60 * 1000;
  const releaseAt = new Date(since.getTime() + totalMs);
  const remainingMs = Math.max(0, releaseAt.getTime() - Date.now());

  return {
    hasCdp: true,
    inCdp: remainingMs > 0,
    hours,
    since,
    releaseAt,
    remainingMs,
    progress: Math.min(1, (totalMs - remainingMs) / totalMs),
  };
}
