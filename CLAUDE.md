# EB Zarkano — Bot do Discord

Bot do servidor do Exército Brasileiro Zarkano (grupo Roblox `7797329`).
Hospedado no Render, que publica sozinho a branch `main`: nunca dar push
direto nela, sempre abrir PR.

O dono do projeto não é programador: explicar mudanças em português simples.

## Onde fica o bot
O repositório é um monorepo pnpm herdado do Replit (`artifacts/`, `lib/`,
`scripts/` não são o bot). O bot é só **`apps/eb-zarkano`**:
- discord.js v14, JavaScript ESM (`"type": "module"`), Node 22.
- `npm start` / `pnpm --filter @workspace/eb-zarkano start` roda `src/index.js`.
- `src/register-commands.js` registra os comandos de barra.
- Dependências: usar `pnpm` (o `preinstall` da raiz bloqueia npm na raiz).

## Estrutura (`apps/eb-zarkano/src`)
- `index.js` — cliente, eventos, roteamento de botões/modais/comandos.
- `config.js` — variáveis de ambiente. `config/channels.js`, `config/roles.js`,
  `config/roblox.js` — IDs fixos de canais, cargos e grupo.
- `commands/` — comandos de barra (`/patente`, `/anunciar`, ...).
- `handlers/` — botões e modais. `services/` — lógica (painéis, logs...).
- `utils/rankNames.js` — normaliza nomes de patente, sigla e apelido.

## Verificação / vínculo Discord <-> Roblox
- O vínculo é feito no site (repo `Site-EB-Zarkano`, ebzarkano.onrender.com),
  que grava a tabela `discord_links` no Postgres (Neon).
- Painel no canal `verificacao` (`services/verificationSystem.js`), rodapé
  "EB Zarkano • Vínculo Roblox". No boot o bot apaga o painel antigo
  (rodapé "EB Zarkano • Verificação") e edita o novo se já existir.
- Botões: "Sincronizar agora" (`services/rankSync.js`), "Vincular conta"
  (passo a passo; se já vinculado, avisa qual conta) e "Problema?" (ajuda).
  Respostas sempre efêmeras.
- Sincronizar: lê `discord_links` (`services/database.js`), busca a patente
  pela Open Cloud v2 (`services/robloxGroup.js`), tira cargos de outras
  patentes, dá o cargo com o mesmo nome (sem sigla/acento), dá Membro se não
  tiver Membro nem Membro Certificado, e põe o apelido `[SIGLA] usuario`
  (máx. 32; "Criador" vira CRIADOR). Cooldown de 20s por pessoa.
- Regra fixa: nunca dar nem tirar cargo com permissão de Administrador.

## Relatório de inatividade da staff
- `services/staffActivity.js`: guarda a última mensagem de quem tem o cargo
  "🔨 | Equipe Administrativa" (achado pelo nome, não pelo ID) (tabela `staff_activity`, criada pelo bot; grava no máx. a cada
  5 min por pessoa). No boot lê as últimas 100 mensagens de cada canal.
- Staff nunca visto começa a contar a partir de quando o bot o viu.
- Todo dia às 12:00 de Brasília manda no canal `inatividadeStaff` quem está
  há mais de 2 dias sem mensagens (sem marcar ninguém). A tabela `bot_state`
  guarda o dia do último relatório pra não repetir se o bot reiniciar.

## Tickets (removido)
- O bot não tem mais sistema de tickets. No boot, `services/legacyCleanup.js`
  apaga o painel antigo "Abrir ticket" que o bot deixou no canal `tickets`.
  Botões antigos sem dono respondem "Esse botão foi desativado".

## Variáveis de ambiente (nunca no código)
`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `ROBLOX_OPEN_CLOUD_API_KEY`,
`DATABASE_URL`, `PORT` (o Render define; servidor de keep-alive).

## Convenções
- Código em inglês, textos pro usuário e comentários em português.
- Respostas a botões com `ephemeral: true`.
- Sem testes automatizados: checar com `node --check` e subir o bot com
  `DISCORD_TOKEN` falso pra ver se carrega sem erro.
