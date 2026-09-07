import * as configurarAcesso from "./configurarAcesso.js";
import * as lockChannel from "./lockChannel.js";
import * as testWelcome from "./testWelcome.js";

export const commands = new Map([
  [configurarAcesso.data.name, configurarAcesso],
  [lockChannel.data.name, lockChannel],
  [testWelcome.data.name, testWelcome],
]);
