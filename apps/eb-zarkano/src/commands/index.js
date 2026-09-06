import * as lockChannel from "./lockChannel.js";
import * as ping from "./ping.js";
import * as testWelcome from "./testWelcome.js";
import * as zarkano from "./zarkano.js";

export const commands = new Map([
  [lockChannel.data.name, lockChannel],
  [ping.data.name, ping],
  [testWelcome.data.name, testWelcome],
  [zarkano.data.name, zarkano],
]);