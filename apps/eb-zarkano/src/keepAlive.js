import http from "node:http";

// >>> Porta usada pelo servidor de keep-alive
// O Render define essa variável automaticamente, não precisa mexer.
const PORT = process.env.PORT || 10000;

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
