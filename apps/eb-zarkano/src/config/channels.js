/**
 * IDs dos canais do servidor usados pelo EB Zarkano.
 *
 * Preencha os valores abaixo com os IDs reais dos canais.
 * Os próximos sistemas poderão reutilizar este mesmo arquivo.
 */
export const channelIds = Object.freeze({
  boasVindas: "1545913570011775066",
  informacoes: "1545913532833333350",
  logs: "1545913410842009680",
  recrutamento: "1545913461702266900",
  tickets: "1545913614769324132",
});

export function getConfiguredChannelId(channelKey) {
  const channelId = channelIds[channelKey];

  if (typeof channelId !== "string" || channelId.trim().length === 0) {
    return null;
  }

  return channelId.trim();
}