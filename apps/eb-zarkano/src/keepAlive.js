import http from "node:http";

// >>> Servidor de keep-alive (só para hosts que exigem uma porta aberta,
// como o Render). Na Square Cloud o bot fica ligado 24/7 sem isso.
// Liga só se KEEP_ALIVE=true ou se o host definir a variável PORT.
const PORT = process.env.PORT || 10000;

export function shouldStartKeepAlive() {
  return process.env.KEEP_ALIVE === "true" || Boolean(process.env.PORT);
}

export function startKeepAliveServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("EB Zarkano bot está online.");
  });

  server.listen(PORT, () => {
    console.info(`Servidor de keep-alive rodando na porta ${PORT}.`);
  });

  return server;
}
