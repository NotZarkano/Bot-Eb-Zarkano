export const channelIds = Object.freeze({
  boasVindas: "1543335998509809694",
  informacoes: "1546222671329759403",
  logs: "1546212495537213460",
  recrutamento: "1543620131911893042",
  tickets: "1546216237497843843",
  verificacao: "1546212105693171782",
});

export function getConfiguredChannelId(channelKey) {
  const channelId = channelIds[channelKey];

  if (typeof channelId !== "string" || channelId.trim().length === 0) {
    return null;
  }

  return channelId.trim();
}
