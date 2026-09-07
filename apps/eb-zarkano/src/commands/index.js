import * as anunciar from "./anunciar.js";
import * as configurarAcesso from "./configurarAcesso.js";
import * as limpar from "./limpar.js";
import * as lockChannel from "./lockChannel.js";
import * as membroFalar from "./membroFalar.js";
import * as membroVer from "./membroVer.js";
import * as patente from "./patente.js";
import * as testWelcome from "./testWelcome.js";

export const commands = new Map([
  [anunciar.data.name, anunciar],
  [configurarAcesso.data.name, configurarAcesso],
  [limpar.data.name, limpar],
  [lockChannel.data.name, lockChannel],
  [membroFalar.data.name, membroFalar],
  [membroVer.data.name, membroVer],
  [patente.data.name, patente],
  [testWelcome.data.name, testWelcome],
]);
