import pg from "pg";

// >>> Conexão com o mesmo banco (Neon) usado pelo site
// Defina DATABASE_URL nas variáveis de ambiente do bot (Render).
let pool = null;

export class LinkSystemInactiveError extends Error {}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new LinkSystemInactiveError("DATABASE_URL não configurada.");
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
    pool.on("error", (error) => {
      console.error("Erro na conexão com o banco de dados:", error);
    });
  }

  return pool;
}

// Consulta genérica no banco (usada por outros sistemas do bot).
export async function query(text, params) {
  return getPool().query(text, params);
}

// Busca o vínculo Discord <-> Roblox feito pelo site.
// Retorna null se a pessoa ainda não vinculou.
export async function findDiscordLink(discordId) {
  try {
    const result = await getPool().query(
      "SELECT roblox_id, roblox_username FROM discord_links WHERE discord_id = $1",
      [discordId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      robloxId: String(row.roblox_id),
      robloxUsername: row.roblox_username,
    };
  } catch (error) {
    // 42P01 = a tabela ainda não existe (o site ainda não criou).
    if (error.code === "42P01") {
      throw new LinkSystemInactiveError("Tabela discord_links não existe.");
    }
    throw error;
  }
}
