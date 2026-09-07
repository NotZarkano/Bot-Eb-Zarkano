import * as configurarAcesso from "./configurarAcesso.js";
import * as lockChannel from "./lockChannel.js";
import * as membroFalar from "./membroFalar.js";
import * as membroVer from "./membroVer.js";
import * as testWelcome from "./testWelcome.js";

export const commands = new Map([
  [configurarAcesso.data.name, configurarAcesso],
  [lockChannel.data.name, lockChannel],
  [membroFalar.data.name, membroFalar],
  [membroVer.data.name, membroVer],
  [testWelcome.data.name, testWelcome],
]);
