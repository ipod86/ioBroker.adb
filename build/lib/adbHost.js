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
var adbHost_exports = {};
__export(adbHost_exports, {
  hostRequest: () => hostRequest
});
module.exports = __toCommonJS(adbHost_exports);
var import_node_net = require("node:net");
function hostRequest(host, port, request, timeoutMs = 3e4) {
  return new Promise((resolve, reject) => {
    const socket = new import_node_net.Socket();
    let buf = Buffer.alloc(0);
    let done = false;
    const finish = (err, text) => {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();
      if (err) {
        reject(err);
      } else {
        resolve(text != null ? text : "");
      }
    };
    const tryParse = (final) => {
      if (buf.length < 4) {
        if (final) {
          finish(new Error("adb server closed the connection without an answer"));
        }
        return;
      }
      const status = buf.subarray(0, 4).toString("ascii");
      if (status !== "OKAY" && status !== "FAIL") {
        finish(new Error(`Unexpected answer from adb server: ${status}`));
        return;
      }
      if (buf.length < 8) {
        if (final) {
          finish(status === "OKAY" ? null : new Error("adb server refused the request"), "");
        }
        return;
      }
      const len = parseInt(buf.subarray(4, 8).toString("ascii"), 16);
      if (Number.isNaN(len)) {
        finish(new Error("Invalid answer length from adb server"));
        return;
      }
      if (buf.length < 8 + len) {
        if (final) {
          finish(new Error("adb server answer was cut off"));
        }
        return;
      }
      const text = buf.subarray(8, 8 + len).toString("utf8");
      finish(status === "OKAY" ? null : new Error(text || "adb server refused the request"), text);
    };
    socket.setTimeout(timeoutMs, () => finish(new Error("No answer from adb server (timeout)")));
    socket.on("error", (err) => finish(err));
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      tryParse(false);
    });
    socket.on("end", () => tryParse(true));
    socket.on("close", () => tryParse(true));
    socket.connect(port, host, () => {
      const len = Buffer.byteLength(request, "utf8").toString(16).padStart(4, "0");
      socket.write(len + request);
    });
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  hostRequest
});
//# sourceMappingURL=adbHost.js.map
