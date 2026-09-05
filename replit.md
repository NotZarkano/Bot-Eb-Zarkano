# EB Zarkano

Bot do Discord baseado em Node.js e discord.js, com comandos slash carregados de forma modular.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/eb-zarkano run dev` — run the bot in development mode
- `pnpm --filter @workspace/eb-zarkano run register` — register the slash commands globally
- `pnpm --filter @workspace/eb-zarkano run start` — start the bot
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Bot: Node.js + discord.js 14

## Where things live

- `apps/eb-zarkano/src/index.js` — conexão do cliente e roteamento de interações
- `apps/eb-zarkano/src/commands/` — comandos slash do bot
- `apps/eb-zarkano/src/config/channels.js` — IDs centralizados dos canais do servidor
- `apps/eb-zarkano/src/events/guildMemberAdd.js` — mensagem automática de boas-vindas
- `apps/eb-zarkano/src/register-commands.js` — registro dos comandos na aplicação Discord
- `apps/eb-zarkano/src/config.js` — validação das variáveis de ambiente

## Architecture decisions

- Os comandos são registrados globalmente pela API do Discord, então não é necessário manter um servidor específico configurado.
- O bot usa as intents `Guilds` e `GuildMembers`, sem habilitar acesso ao conteúdo das mensagens.
- A intent `GuildMembers` é usada somente para detectar novas entradas e enviar boas-vindas.
- O token e o Application ID são lidos exclusivamente dos Secrets do Replit.

## Product

O EB Zarkano responde aos comandos slash `/ping` e `/zarkano`, com base pronta para novos comandos independentes.

## User preferences

Nenhuma preferência adicional registrada.

## Gotchas

- Depois de adicionar ou alterar comandos, execute `pnpm --filter @workspace/eb-zarkano run register` para sincronizá-los com o Discord.
- Para ativar as boas-vindas, preencha `channelIds.boasVindas` em `apps/eb-zarkano/src/config/channels.js` e ative o Server Members Intent no Discord Developer Portal.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
