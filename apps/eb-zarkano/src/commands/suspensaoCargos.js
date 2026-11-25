import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

// /suspensaocargos: apaga TODOS os cargos do servidor que o bot consegue
// apagar. Não tem como desfazer: só o dono do servidor usa, precisa
// confirmar num botão, e o bot manda antes, no privado do dono, a lista de
// todos os cargos (nome, cor, permissões...) para dar para recriar depois.
// O Discord não deixa apagar: @everyone, cargos de bots/integrações e de
// impulso (Nitro), nem cargos acima do cargo do bot.
const TEMPO_PARA_CONFIRMAR_MS = 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("suspensaocargos")
  .setDescription("Apaga todos os cargos do servidor (só o dono do servidor).")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

// Cópia dos cargos para recriar depois, se precisar.
function copiaDosCargos(cargos) {
  return cargos.map((cargo) => ({
    id: cargo.id,
    nome: cargo.name,
    cor: cargo.hexColor,
    posicao: cargo.position,
    separadoNaLista: cargo.hoist,
    mencionavel: cargo.mentionable,
    membros: cargo.members?.size ?? null,
    permissoes: cargo.permissions.toArray(),
  }));
}

async function mandarNoPrivado(usuario, mensagem) {
  try {
    await usuario.send(mensagem);
    return true;
  } catch (erro) {
    console.warn("[suspensaocargos] não consegui mandar mensagem no privado:", erro.message);
    return false;
  }
}

export async function execute(interaction) {
  const guild = interaction.guild;

  if (!guild || interaction.user.id !== guild.ownerId) {
    await interaction.reply({
      content: "🔒 Só o dono do servidor pode usar o /suspensaocargos.",
      ephemeral: true,
    });
    return;
  }

  const cargos = await guild.roles.fetch();
  // Só os que o Discord deixa o bot apagar (abaixo do bot, não gerenciados,
  // não @everyone). Do mais baixo para o mais alto.
  const paraApagar = [...cargos.values()]
    .filter((cargo) => cargo.id !== guild.id && !cargo.managed && cargo.editable)
    .sort((a, b) => a.position - b.position);
  const ficam = [...cargos.values()].filter(
    (cargo) => cargo.id !== guild.id && !paraApagar.includes(cargo),
  );

  if (paraApagar.length === 0) {
    await interaction.reply({
      content: "Não há cargos que eu consiga apagar (os que sobraram são de bots, de impulso ou estão acima do meu cargo).",
      ephemeral: true,
    });
    return;
  }

  const confirmar = new ButtonBuilder()
    .setCustomId("suspensaocargos:confirmar")
    .setLabel(`Apagar ${paraApagar.length} cargos`)
    .setEmoji("🗑️")
    .setStyle(ButtonStyle.Danger);
  const cancelar = new ButtonBuilder()
    .setCustomId("suspensaocargos:cancelar")
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Secondary);

  const aviso = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("⚠️ Suspensão de cargos")
    .setDescription(
      [
        `Vou **apagar ${paraApagar.length} cargos**. Todo mundo perde esses cargos. **Não dá para desfazer.**`,
        "",
        ficam.length
          ? `Ficam ${ficam.length} cargo(s) que o Discord não deixa eu apagar (de bots, de impulso ou acima do meu cargo).`
          : "",
        "Antes de apagar, mando no seu privado uma lista com todos os cargos, para dar para recriar depois.",
        "Você tem 1 minuto para confirmar.",
      ].filter(Boolean).join("\n"),
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

  if (clique.customId !== "suspensaocargos:confirmar") {
    await clique.update({ content: "Cancelado. Nada foi apagado.", embeds: [], components: [] });
    return;
  }

  await clique.update({ content: "🗑️ Apagando os cargos... O resultado vai chegar no seu privado.", embeds: [], components: [] });

  const copia = JSON.stringify(
    { servidor: guild.name, data: new Date().toISOString(), cargos: copiaDosCargos(paraApagar) },
    null,
    2,
  );
  await mandarNoPrivado(interaction.user, {
    content: `📋 Lista dos ${paraApagar.length} cargos que o /suspensaocargos vai apagar em **${guild.name}** (para recriar depois, se precisar).`,
    files: [new AttachmentBuilder(Buffer.from(copia, "utf8"), { name: "cargos-apagados.json" })],
  });

  const falhas = [];
  let apagados = 0;
  for (const cargo of paraApagar) {
    try {
      await cargo.delete(`/suspensaocargos por ${interaction.user.tag}`);
      apagados++;
    } catch (erro) {
      falhas.push(`@${cargo.name} (${erro.message})`);
    }
  }

  console.info(`[suspensaocargos] ${apagados} cargos apagados por ${interaction.user.tag}; ${falhas.length} falharam.`);

  const resultado = [
    `✅ Suspensão de cargos: **${apagados}** cargos apagados em **${guild.name}**.`,
    falhas.length
      ? `⚠️ Não consegui apagar ${falhas.length}:\n${falhas.slice(0, 20).map((f) => `• ${f}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n").slice(0, 1900);

  const enviado = await mandarNoPrivado(interaction.user, { content: resultado });
  if (!enviado) {
    await interaction.editReply({ content: resultado }).catch(() => {});
  }
}
