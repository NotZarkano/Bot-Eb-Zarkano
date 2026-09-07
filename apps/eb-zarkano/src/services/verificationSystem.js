export async function sendVerificationPrompt(member) {
  const verificationChannelId = getConfiguredChannelId("verificacao");

  if (!verificationChannelId) {
    return { sent: false, reason: "missing-channel" };
  }

  const embed = new EmbedBuilder()
    .setColor(EB_ZARKANO_GREEN)
    .setTitle("✅ Falta pouco para você ter acesso completo!")
    .setDescription(
      [
        `Olá, ${member}! Para liberar o restante do servidor **EB Zarkano**, acesse o canal <#${verificationChannelId}> e clique no botão de verificação.`,
      ].join("\n"),
    )
    .setFooter({ text: VERIFICATION_PANEL_FOOTER })
    .setTimestamp();

  try {
    await member.send({ embeds: [embed] });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: "dm-closed" };
  }
}
