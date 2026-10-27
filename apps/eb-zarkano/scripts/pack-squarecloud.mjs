// Gera o zip para subir na Square Cloud: dist/eb-zarkano-squarecloud.zip
// Uso (dentro de apps/eb-zarkano): npm run pack:squarecloud
//
// O zip leva só o que o bot precisa: squarecloud.app, package.json, src/
// e assets/. Nada de node_modules, lockfiles, data/ ou .env (a Square Cloud
// roda "npm install" sozinha e as variáveis ficam no painel dela).
// Feito só com o Node (sem programa de zip), para funcionar no Windows também.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const BOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = ["squarecloud.app", "package.json", "src", "assets"];
const OUTPUT = join(BOT_DIR, "dist", "eb-zarkano-squarecloud.zip");

function listFiles(path) {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).sort().flatMap((name) => listFiles(join(path, name)));
  }
  return [path];
}

// Data/hora no formato do zip (MS-DOS).
function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const files = INCLUDE.flatMap((item) => listFiles(join(BOT_DIR, item)));
const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(BOT_DIR, file).split(sep).join("/"));
  const data = readFileSync(file);
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);
  const { time, day } = dosDateTime(statSync(file).mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // versão necessária
  local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  localParts.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);

  offset += local.length + name.length + compressed.length;
}

const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, Buffer.concat([...localParts, ...centralParts, end]));
console.info(`Zip criado: ${relative(process.cwd(), OUTPUT)} (${files.length} arquivos)`);
