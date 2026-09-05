import * as ping from "./ping.js";
import * as zarkano from "./zarkano.js";

export const commands = new Map([
  [ping.data.name, ping],
  [zarkano.data.name, zarkano],
]);