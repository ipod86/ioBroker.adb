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
var discovery_exports = {};
__export(discovery_exports, {
  Discovery: () => Discovery
});
module.exports = __toCommonJS(discovery_exports);
var import_bonjour_service = require("bonjour-service");
const CONNECT = "adb-tls-connect";
const PAIRING = "adb-tls-pairing";
class Discovery {
  /**
   * @param log logger
   * @param log.debug debug output
   * @param log.warn warning output
   * @param timers timers of the adapter (cleared automatically on unload)
   * @param timers.setTimeout starts a timer
   * @param timers.clearTimeout stops a timer
   */
  constructor(log, timers) {
    this.log = log;
    this.timers = timers;
  }
  bonjour;
  browsers = [];
  connect = /* @__PURE__ */ new Map();
  pairing = /* @__PURE__ */ new Map();
  waiters = [];
  /** Starts listening */
  start() {
    try {
      this.bonjour = new import_bonjour_service.Bonjour(void 0, (err) => {
        this.log.warn(`mDNS error: ${err instanceof Error ? err.message : String(err)}`);
      });
      this.browsers.push(this.browse(CONNECT, this.connect));
      this.browsers.push(this.browse(PAIRING, this.pairing));
    } catch (e) {
      this.log.warn(`mDNS discovery could not be started: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  /**
   * Starts browsing one service type.
   *
   * @param type device type or service type
   * @param map store for the found services
   */
  browse(type, map) {
    const browser = this.bonjour.find({ type, protocol: "tcp" });
    const add = (s) => {
      const ip = pickIPv4(s);
      if (!ip || !s.port) {
        return;
      }
      const found = { name: s.name, ip, port: s.port, seen: Date.now() };
      map.set(s.name, found);
      this.log.debug(`mDNS ${type}: ${s.name} at ${ip}:${s.port}`);
      if (type === PAIRING) {
        this.waiters = this.waiters.filter((w) => {
          if (w.match(found)) {
            w.resolve(found);
            return false;
          }
          return true;
        });
      }
    };
    browser.on("up", add);
    browser.on("srv-update", add);
    browser.on("down", (s) => {
      map.delete(s.name);
      this.log.debug(`mDNS ${type}: ${s.name} gone`);
    });
    return browser;
  }
  /** Sends a new query, so devices answer at once instead of at their next announcement */
  refresh() {
    for (const b of this.browsers) {
      try {
        b.update();
      } catch {
      }
    }
  }
  /**
   * Current connect port of a device.
   *
   * @param ip IP address of the device
   */
  connectPort(ip) {
    var _a;
    return (_a = this.latest(this.connect, (s) => s.ip === ip)) == null ? void 0 : _a.port;
  }
  /**
   * Pairing port of a device that currently shows the "pair with code" dialog.
   *
   * @param ip IP address of the device
   */
  pairingPort(ip) {
    var _a;
    return (_a = this.latest(this.pairing, (s) => s.ip === ip)) == null ? void 0 : _a.port;
  }
  /** All devices that announce wireless debugging */
  devices() {
    return [...this.connect.values()].sort((a, b) => a.ip.localeCompare(b.ip));
  }
  /**
   * Waits until a phone announces a pairing service that matches.
   *
   * @param match filter
   * @param timeoutMs time limit
   */
  waitForPairing(match, timeoutMs) {
    const existing = this.latest(this.pairing, match);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve) => {
      const waiter = {
        match,
        resolve: (s) => {
          this.timers.clearTimeout(waiter.timer);
          resolve(s);
        }
      };
      waiter.timer = this.timers.setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(void 0);
      }, timeoutMs);
      this.waiters.push(waiter);
      this.refresh();
    });
  }
  /**
   * Newest announcement that matches.
   *
   * @param map store for the found services
   * @param match filter
   */
  latest(map, match) {
    let best;
    for (const s of map.values()) {
      if (match(s) && (!best || s.seen > best.seen)) {
        best = s;
      }
    }
    return best;
  }
  /** Stops listening */
  stop() {
    var _a;
    for (const b of this.browsers) {
      try {
        b.stop();
      } catch {
      }
    }
    this.browsers = [];
    for (const w of this.waiters) {
      this.timers.clearTimeout(w.timer);
    }
    this.waiters = [];
    try {
      (_a = this.bonjour) == null ? void 0 : _a.destroy();
    } catch {
    }
    this.bonjour = void 0;
  }
}
function pickIPv4(s) {
  var _a, _b;
  const v4 = ((_a = s.addresses) != null ? _a : []).find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  if (v4) {
    return v4;
  }
  const ref = (_b = s.referer) == null ? void 0 : _b.address;
  return ref && /^\d+\.\d+\.\d+\.\d+$/.test(ref) ? ref : void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Discovery
});
//# sourceMappingURL=discovery.js.map
