import * as lockChannel from "./lockChannel.js";
import * as testWelcome from "./testWelcome.js";

export const commands = new Map([
  [lockChannel.data.name, lockChannel],
  [testWelcome.data.name, testWelcome],
]);
