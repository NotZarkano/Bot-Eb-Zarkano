const SIGLA_PATTERN = /^\s*\[([^\]]+)\]\s*/;

// "[CB] Cabo" -> "cabo"; "1º Sargento" -> "1 sargento".
// Compara nomes sem sigla, sem acento e sem símbolos.
export function normalizeRankName(name) {
  return (name ?? "")
    .replace(SIGLA_PATTERN, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "[CB] Cabo" -> "CB". "Criador" não tem sigla: vira "CRIADOR".
export function extractSigla(rankName) {
  const match = (rankName ?? "").match(SIGLA_PATTERN);

  if (match) {
    return match[1].trim().toUpperCase();
  }

  if (normalizeRankName(rankName) === "criador") {
    return "CRIADOR";
  }

  return null;
}

// Apelido "[SIGLA] usuario_roblox", no máximo 32 caracteres (limite do Discord).
export function buildNickname(rankName, robloxUsername) {
  const sigla = extractSigla(rankName);
  const nickname = sigla ? `[${sigla}] ${robloxUsername}` : robloxUsername;
  return nickname.slice(0, 32);
}
