/**
 * IDs dos canais do servidor usados pelo EB Zarkano.
 *
 * Preencha os valores abaixo com os IDs reais dos canais.
 * Os próximos sistemas poderão reutilizar este mesmo arquivo.
 */
export const channelIds = Object.freeze({
  boasVindas: "",
  informacoes: "",
  logs: "",
  recrutamento: "",
  tickets: "",
});

export function getConfiguredChannelId(channelKey) {
  const channelId = channelIds[channelKey];

  if (typeof channelId !== "string" || channelId.trim().length === 0) {
    return null;
  }

  return channelId.trim();
}