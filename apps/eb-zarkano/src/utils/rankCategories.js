import { normalizeRankName } from "./rankNames.js";

// >>> Cargos de "grupo" do Discord, achados pelo nome (sem emoji/acento).
// Ex.: "🎯 | PRAÇAS" -> "pracas".
export const CATEGORY_ROLE_NAMES = Object.freeze({
  pracas: "pracas",
  pracasEspeciais: "pracas especiais",
  graduados: "graduados",
  oficiaisInferiores: "oficiais inferiores",
  oficiaisIntermediarios: "oficiais intermediarios",
  oficiaisSuperiores: "oficiais superiores",
  oficiaisGenerais: "oficiais generais",
  honorarias: "patentes honorarias",
  administracao: "equipe administrativa",
});

// Grupo de cada patente do EB. Mesma divisão da tabela da CDP.
// Marechal -> Patentes Honorárias; administração -> Equipe Administrativa.
export function categoryForRank(rankName) {
  const name = normalizeRankName(rankName);
  const has = (word) => new RegExp(`(^| )${word}( |$)`).test(name);

  if (has("marechal")) return "honorarias";
  if (["criador", "fundador", "administrador", "administracao", "supervisor", "moderador"].some((word) => name.includes(word))) {
    return "administracao";
  }
  if (has("general")) return "oficiaisGenerais";
  if (has("coronel") || has("major")) return "oficiaisSuperiores";
  if (has("capitao")) return "oficiaisIntermediarios";
  if (has("subtenente") || has("sargento")) return "graduados";
  if (has("tenente") || has("aspirante")) return "oficiaisInferiores";
  if (has("cadete")) return "pracasEspeciais";
  if (has("recruta") || has("soldado") || has("cabo")) return "pracas";
  return null;
}
