import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

// /modosuspensao: apaga TODOS os canais do servidor, menos estes dois
// (chat e anúncios gerais) e as categorias onde eles estão.
// Não tem como desfazer: por isso só o dono do servidor usa, precisa
// confirmar num botão, e o bot manda antes, no privado do dono, uma lista
// de tudo o que vai ser apagado (para dar para recriar à mão depois).
const CANAIS_MANTIDOS = Object.freeze({
  "1543434264983379968": "chat",
  "1543335341916950579": "anúncios gerais",
});

const TEMPO_PARA_CONFIRMAR_MS = 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("modosuspensao")
  .setDescription("Apaga todos os canais, menos o chat e os anúncios gerais (só o dono do servidor).")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

const NOMES_DOS_TIPOS = {
  [ChannelType.GuildText]: "texto",
  [ChannelType.GuildVoice]: "voz",
  [ChannelType.GuildCategory]: "categoria",
  [ChannelType.GuildAnnouncement]: "anúncios",
  [ChannelType.GuildStageVoice]: "palco",
  [ChannelType.GuildForum]: "fórum",
  [ChannelType.GuildMedia]: "mídia",
};

// Cópia do que vai ser apagado (nome, tipo, categoria, permissões...).
function copiaDosCanais(canais) {
  return canais.map((canal) => ({
    id: canal.id,
    nome: canal.name,
    tipo: NOMES_DOS_TIPOS[canal.type] ?? String(canal.type),
    categoria: canal.parent?.name ?? null,
    posicao: canal.rawPosition,
    topico: canal.topic ?? null,
    nsfw: canal.nsfw ?? false,
    modoLento: canal.rateLimitPerUser ?? 0,
    permissoes: canal.permissionOverwrites?.cache.map((p) => ({
      id: p.id,
      tipo: p.type === 0 ? "cargo" : "membro",
      permitido: p.allow.toArray(),
      negado: p.deny.toArray(),
    })) ?? [],
  }));
}

async function mandarNoPrivado(usuario, mensagem) {
  try {
    await usuario.send(mensagem);
    return true;
  } catch (erro) {
    console.warn("[modosuspensao] não consegui mandar mensagem no privado:", erro.message);
    return false;
  }
}

export async function execute(interaction) {
  const guild = interaction.guild;

  if (!guild || interaction.user.id !== guild.ownerId) {
    await interaction.reply({
      content: "🔒 Só o dono do servidor pode usar o /modosuspensao.",
      ephemeral: true,
    });
    return;
  }

  const todos = await guild.channels.fetch();
  const mantidos = Object.keys(CANAIS_MANTIDOS).map((id) => todos.get(id)).filter(Boolean);

  // Segurança: se um dos canais que ficam não existir mais, não apaga nada.
  if (mantidos.length !== Object.keys(CANAIS_MANTIDOS).length) {
    await interaction.reply({
      content: "⚠️ Não encontrei o canal de chat ou o de anúncios gerais. Por segurança, nada foi apagado.",
      ephemeral: true,
    });
    return;
  }

  // As categorias onde o chat e os anúncios estão também ficam.
  const idsQueFicam = new Set([
    ...mantidos.map((canal) => canal.id),
    ...mantidos.map((canal) => canal.parentId).filter(Boolean),
  ]);
  const paraApagar = [...todos.values()]
    .filter((canal) => canal && !idsQueFicam.has(canal.id))
    // Canais dentro de categorias primeiro, categorias por último.
    .sort((a, b) => Number(a.type === ChannelType.GuildCategory) - Number(b.type === ChannelType.GuildCategory));

  if (paraApagar.length === 0) {
    await interaction.reply({ content: "Já não há outros canais para apagar.", ephemeral: true });
    return;
  }

  const confirmar = new ButtonBuilder()
    .setCustomId("modosuspensao:confirmar")
    .setLabel(`Apagar ${paraApagar.length} canais`)
    .setEmoji("🗑️")
    .setStyle(ButtonStyle.Danger);
  const cancelar = new ButtonBuilder()
    .setCustomId("modosuspensao:cancelar")
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Secondary);

  const aviso = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("⚠️ Modo suspensão")
    .setDescription(
      [
        `Vou **apagar ${paraApagar.length} canais** (e as conversas deles). **Não dá para desfazer.**`,
        "",
        `Ficam só: ${mantidos.map((canal) => `${canal}`).join(" e ")} (e a categoria deles).`,
        "",
        "Antes de apagar, mando no seu privado uma lista com todos os canais, para dar para recriar depois.",
        "Você tem 1 minuto para confirmar.",
      ].join("\n"),
    );

  const resposta = await interaction.reply({
    embeds: [aviso],
    components: [new ActionRowBuilder().addComponents(confirmar, cancelar)],
    ephemeral: true,
    fetchReply: true,
  });

  let clique;
  try {
    clique = await resposta.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: TEMPO_PARA_CONFIRMAR_MS,
    });
  } catch {
    await interaction.editReply({ content: "⏱️ Tempo esgotado. Nada foi apagado.", embeds: [], components: [] });
    return;
  }

  if (clique.customId !== "modosuspensao:confirmar") {
    await clique.update({ content: "Cancelado. Nada foi apagado.", embeds: [], components: [] });
    return;
  }

  await clique.update({ content: "🗑️ Apagando os canais... O resultado vai chegar no seu privado.", embeds: [], components: [] });

  // Lista de tudo o que vai ser apagado, no privado do dono.
  const copia = JSON.stringify(
    { servidor: guild.name, data: new Date().toISOString(), canais: copiaDosCanais(paraApagar) },
    null,
    2,
  );
  await mandarNoPrivado(interaction.user, {
    content: `📋 Lista dos ${paraApagar.length} canais que o /modosuspensao vai apagar em **${guild.name}** (para recriar depois, se precisar).`,
    files: [new AttachmentBuilder(Buffer.from(copia, "utf8"), { name: "canais-apagados.json" })],
  });

  const falhas = [];
  let apagados = 0;
  for (const canal of paraApagar) {
    try {
      await canal.delete(`/modosuspensao por ${interaction.user.tag}`);
      apagados++;
    } catch (erro) {
      // Ex.: canal de regras de servidor da Comunidade, ou sem permissão.
      falhas.push(`#${canal.name} (${erro.message})`);
    }
  }

  console.info(`[modosuspensao] ${apagados} canais apagados por ${interaction.user.tag}; ${falhas.length} falharam.`);

  const resultado = [
    `✅ Modo suspensão: **${apagados}** canais apagados em **${guild.name}**.`,
    falhas.length
      ? `⚠️ Não consegui apagar ${falhas.length}:\n${falhas.slice(0, 20).map((f) => `• ${f}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n").slice(0, 1900);

  const enviado = await mandarNoPrivado(interaction.user, { content: resultado });
  if (!enviado) {
    // Se o privado estiver fechado, tenta mostrar na própria resposta.
    await interaction.editReply({ content: resultado }).catch(() => {});
  }
}
