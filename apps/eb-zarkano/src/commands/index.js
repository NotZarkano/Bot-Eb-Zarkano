import * as ping from "./ping.js";
import * as testWelcome from "./testWelcome.js";
import * as zarkano from "./zarkano.js";

export const commands = new Map([
  [ping.data.name, ping],
  [testWelcome.data.name, testWelcome],
  [zarkano.data.name, zarkano],
]);