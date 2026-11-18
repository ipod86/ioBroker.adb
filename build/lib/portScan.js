"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var portScan_exports = {};
__export(portScan_exports, {
  WIRELESS_PORT_RANGE: () => WIRELESS_PORT_RANGE,
  findOpenPorts: () => findOpenPorts,
  probePort: () => probePort
});
module.exports = __toCommonJS(portScan_exports);
var import_node_net = require("node:net");
const WIRELESS_PORT_RANGE = [32768, 60999];
function probePort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new import_node_net.Socket();
    let done = false;
    const finish = (result) => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(result);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("open"));
    socket.once("timeout", () => finish("timeout"));
    socket.once("error", (e) => finish(e.code === "ECONNREFUSED" ? "closed" : "timeout"));
    socket.connect(port, host);
  });
}
async function findOpenPorts(host, options = {}) {
  var _a, _b, _c, _d, _e;
  const [from, to] = (_a = options.range) != null ? _a : WIRELESS_PORT_RANGE;
  const concurrency = (_b = options.concurrency) != null ? _b : 256;
  const timeoutMs = (_c = options.timeoutMs) != null ? _c : 500;
  const giveUpAfter = (_d = options.giveUpAfter) != null ? _d : 300;
  const probe = (_e = options.probe) != null ? _e : probePort;
  const open = [];
  let next = from;
  let probed = 0;
  let answered = 0;
  let stop = false;
  const worker = async () => {
    while (!stop && next <= to) {
      const port = next++;
      const result = await probe(host, port, timeoutMs);
      probed++;
      if (result !== "timeout") {
        answered++;
      }
      if (result === "open") {
        open.push(port);
      }
      if (!answered && probed >= giveUpAfter) {
        stop = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, to - from + 1) }, () => worker()));
  return open.sort((a, b) => a - b);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WIRELESS_PORT_RANGE,
  findOpenPorts,
  probePort
});
//# sourceMappingURL=portScan.js.map
