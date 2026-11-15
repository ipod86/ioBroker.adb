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
var util_exports = {};
__export(util_exports, {
  ADB_MIN_PAIRING: () => ADB_MIN_PAIRING,
  AUTOMATION_APPS: () => AUTOMATION_APPS,
  checkDevices: () => checkDevices,
  cleanShellCommand: () => cleanShellCommand,
  deviceObjectId: () => deviceObjectId,
  extractPng: () => extractPng,
  hostOfSerial: () => hostOfSerial,
  isPackageName: () => isPackageName,
  isValidPairingCode: () => isValidPairingCode,
  legacyObjectId: () => legacyObjectId,
  normalizePairingCode: () => normalizePairingCode,
  pairSucceeded: () => pairSucceeded,
  pairingQrText: () => pairingQrText,
  parseAdbVersion: () => parseAdbVersion,
  parsePackages: () => parsePackages,
  parsePort: () => parsePort,
  portOfSerial: () => portOfSerial,
  startComponent: () => startComponent,
  stopPackage: () => stopPackage
});
module.exports = __toCommonJS(util_exports);
function parsePort(port) {
  const n = typeof port === "number" ? port : parseInt(String(port != null ? port : "").trim(), 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : void 0;
}
function deviceObjectId(ip, port) {
  const base = port ? `${ip.trim().toLowerCase()}:${port}` : ip.trim().toLowerCase();
  return base.replace(/[.:]/g, "_").replace(/[^A-Za-z0-9_-]/g, "_");
}
function hostOfSerial(serial) {
  const m = /^(.+):(\d+)$/.exec(serial);
  return m ? m[1] : void 0;
}
function portOfSerial(serial) {
  const m = /:(\d+)$/.exec(serial);
  return m ? parseInt(m[1], 10) : void 0;
}
function normalizePairingCode(code) {
  return String(code != null ? code : "").replace(/[\s-]/g, "");
}
function isValidPairingCode(code) {
  return /^\d{6}$/.test(code);
}
function pairSucceeded(answer) {
  return /successfully paired/i.test(answer);
}
function pairingQrText(name, password) {
  return `WIFI:T:ADB;S:${name};P:${password};;`;
}
function startComponent(component) {
  const c = component.trim();
  return c.includes("/") ? c : `${c}/.MainActivity`;
}
function stopPackage(pkg) {
  return pkg.split("/")[0].trim();
}
function cleanShellCommand(command) {
  let c = command.trim();
  if (/^shell(\s|$)/.test(c)) {
    c = c.substring(5).trim();
  }
  return c;
}
const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function extractPng(data) {
  const i = data.indexOf(PNG_HEADER);
  return i > 0 ? data.subarray(i) : data;
}
function checkDevices(devices) {
  var _a;
  const ok = [];
  const problems = [];
  const seen = /* @__PURE__ */ new Set();
  for (const d of devices != null ? devices : []) {
    if (!d || d.enabled === false) {
      continue;
    }
    const ip = String((_a = d.ip) != null ? _a : "").trim();
    if (!ip) {
      problems.push(`Device "${d.name || "?"}" has no IP address and is skipped`);
      continue;
    }
    const port = parsePort(d.port);
    const id = deviceObjectId(ip, port);
    if (seen.has(id)) {
      problems.push(`Device ${ip}${port ? `:${port}` : ""} is listed twice, the second entry is skipped`);
      continue;
    }
    seen.add(id);
    ok.push({ ...d, ip, port: port != null ? port : "" });
  }
  return { ok, problems };
}
const AUTOMATION_APPS = {
  "com.arlosoft.macrodroid": "MacroDroid",
  "net.dinglisch.android.taskerm": "Tasker",
  "com.llamalab.automate": "Automate"
};
function parsePackages(output) {
  return output.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("package:")).map((l) => l.substring(8).trim()).filter(Boolean);
}
function isPackageName(pkg) {
  return /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(pkg);
}
function parseAdbVersion(output) {
  const m = /^Version\s+((?:\d+:)?(\d+)\.\d+\S*)/m.exec(output);
  return m ? { text: m[1], major: parseInt(m[2], 10) } : void 0;
}
const ADB_MIN_PAIRING = 30;
function legacyObjectId(ip, port) {
  return `${ip.trim()}:${port}`.replace(/\./g, "_");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADB_MIN_PAIRING,
  AUTOMATION_APPS,
  checkDevices,
  cleanShellCommand,
  deviceObjectId,
  extractPng,
  hostOfSerial,
  isPackageName,
  isValidPairingCode,
  legacyObjectId,
  normalizePairingCode,
  pairSucceeded,
  pairingQrText,
  parseAdbVersion,
  parsePackages,
  parsePort,
  portOfSerial,
  startComponent,
  stopPackage
});
//# sourceMappingURL=util.js.map
