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
  INFO_SEPARATOR: () => INFO_SEPARATOR,
  checkDevices: () => checkDevices,
  cleanShellCommand: () => cleanShellCommand,
  deviceObjectId: () => deviceObjectId,
  extractPng: () => extractPng,
  hostOfSerial: () => hostOfSerial,
  infoCommand: () => infoCommand,
  isPackageName: () => isPackageName,
  isValidPairingCode: () => isValidPairingCode,
  legacyObjectId: () => legacyObjectId,
  normalizePairingCode: () => normalizePairingCode,
  pairSucceeded: () => pairSucceeded,
  pairingQrText: () => pairingQrText,
  parseAdbVersion: () => parseAdbVersion,
  parseInfo: () => parseInfo,
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
const INFO_SEPARATOR = "@@adb-info@@";
function infoCommand(withStorage) {
  const parts = [
    "dumpsys battery",
    "dumpsys power | grep mWakefulness=",
    "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'",
    "dumpsys wifi | grep -m1 mWifiInfo",
    "settings get global zen_mode"
  ];
  if (withStorage) {
    parts.push("df /data | tail -1");
  }
  return parts.join(`; echo ${INFO_SEPARATOR}; `);
}
function parseInfo(output) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const [battery = "", power = "", window = "", wifi = "", zen = "", storage = ""] = output.split(INFO_SEPARATOR);
  const info = {};
  const field = (name) => {
    var _a2, _b2;
    return (_b2 = (_a2 = new RegExp(`^ {1,2}${name}: (.+)$`, "mi").exec(battery)) == null ? void 0 : _a2[1]) == null ? void 0 : _b2.trim();
  };
  if (field("level") !== void 0) {
    const present = field("present") !== "false";
    info.battery = { present };
    if (present) {
      const level = parseInt((_a = field("level")) != null ? _a : "", 10);
      const status = parseInt((_b = field("status")) != null ? _b : "", 10);
      const temp = parseInt((_c = field("temperature")) != null ? _c : "", 10);
      const source = ["AC", "USB", "Wireless", "Dock"].find((s) => field(`${s} powered`) === "true");
      info.battery.level = Number.isNaN(level) ? void 0 : level;
      info.battery.charging = status === 2;
      info.battery.source = source ? source.toLowerCase() : "none";
      info.battery.temperature = Number.isNaN(temp) ? void 0 : temp / 10;
    }
  }
  const wake = (_d = /mWakefulness=(\w+)/.exec(power)) == null ? void 0 : _d[1];
  if (wake && !/^\d+$/.test(wake)) {
    info.screenOn = wake === "Awake";
  }
  const app = (_g = (_e = /mCurrentFocus=Window\{\S+ \S+ ([\w.]+)\//.exec(window)) == null ? void 0 : _e[1]) != null ? _g : (_f = /mFocusedApp=ActivityRecord\{\S+ \S+ ([\w.]+)\//.exec(window)) == null ? void 0 : _f[1];
  if (app) {
    info.currentApp = app;
  }
  if (wifi.includes("mWifiInfo")) {
    const ssid = (_h = /SSID: "([^"]*)"/.exec(wifi)) == null ? void 0 : _h[1];
    const rssi = parseInt((_j = (_i = /RSSI: (-?\d+)/.exec(wifi)) == null ? void 0 : _i[1]) != null ? _j : "", 10);
    info.wifiSsid = ssid && ssid !== "<unknown ssid>" ? ssid : "";
    if (!Number.isNaN(rssi) && rssi < 0 && rssi > -127) {
      info.wifiRssi = rssi;
    }
  }
  const z = zen.trim();
  if (/^\d+$/.test(z)) {
    info.doNotDisturb = z !== "0";
  }
  const df = storage.trim().split(/\s+/);
  if (df.length >= 4 && /^\d+$/.test(df[3])) {
    info.storageFreeGB = Math.round(parseInt(df[3], 10) / 1024 / 1024 * 10) / 10;
  }
  return info;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADB_MIN_PAIRING,
  AUTOMATION_APPS,
  INFO_SEPARATOR,
  checkDevices,
  cleanShellCommand,
  deviceObjectId,
  extractPng,
  hostOfSerial,
  infoCommand,
  isPackageName,
  isValidPairingCode,
  legacyObjectId,
  normalizePairingCode,
  pairSucceeded,
  pairingQrText,
  parseAdbVersion,
  parseInfo,
  parsePackages,
  parsePort,
  portOfSerial,
  startComponent,
  stopPackage
});
//# sourceMappingURL=util.js.map
