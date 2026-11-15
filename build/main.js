"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_node_crypto = require("node:crypto");
var import_adbkit = require("@devicefarmer/adbkit");
var import_adbHost = require("./lib/adbHost");
var import_device = require("./lib/device");
var import_discovery = require("./lib/discovery");
var import_util = require("./lib/util");
class AdbAdapter extends utils.Adapter {
  client;
  tracker;
  discovery;
  devices = [];
  timer;
  serverHost = "127.0.0.1";
  serverPort = 5037;
  serverOk;
  qr;
  /**
   * @param options adapter options
   */
  constructor(options = {}) {
    super({ ...options, name: "adb" });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /** Starts the adapter. */
  async onReady() {
    var _a;
    await this.setState("info.connection", false, true);
    const host = String(this.config.adbHostOption || "127.0.0.1").trim();
    this.serverHost = host === "localhost" ? "127.0.0.1" : host;
    this.serverPort = (_a = (0, import_util.parsePort)(this.config.adbPortOption)) != null ? _a : 5037;
    const bin = String(this.config.adbPath || "").trim() || "adb";
    this.client = import_adbkit.Adb.createClient({ host: this.serverHost, port: this.serverPort, bin });
    this.discovery = new import_discovery.Discovery(this.log);
    this.discovery.start();
    const { ok, problems } = (0, import_util.checkDevices)(this.config.devices);
    problems.forEach((p) => this.log.warn(p));
    for (const cfg of ok) {
      const dev = new import_device.AndroidDevice(this, this.client, this.discovery, cfg);
      await this.createDeviceObjects(dev);
      await this.setState(dev.stateId("connection"), false, true);
      this.devices.push(dev);
    }
    if (!this.devices.length) {
      this.log.info("No devices configured yet. Add them in the adapter settings.");
    }
    await this.subscribeStatesAsync("*");
    this.setTimeout(() => void this.tick(), 3e3);
    const interval = Math.max(10, Number(this.config.reconnectInterval) || 30);
    this.timer = this.setInterval(() => void this.tick(), interval * 1e3);
  }
  /** Checks the adb server and reconnects devices */
  async tick() {
    if (!this.tracker && !await this.startTracking()) {
      return;
    }
    for (const dev of this.devices) {
      if (!dev.connected) {
        await dev.ensureConnected(true);
      }
    }
  }
  /** Connects to the adb server and follows its device list. */
  async startTracking() {
    try {
      await this.client.version();
      const tracker = await this.client.trackDevices();
      this.tracker = tracker;
      tracker.on("add", (d) => void this.onTracker(d.id, d.type));
      tracker.on("change", (d) => void this.onTracker(d.id, d.type));
      tracker.on("remove", (d) => void this.onTracker(d.id, void 0));
      tracker.on("end", () => {
        var _a;
        this.tracker = void 0;
        this.serverOk = false;
        void this.setState("info.connection", false, true);
        this.log.warn("Connection to adb server lost, retrying");
        for (const dev of this.devices) {
          void dev.onTracker((_a = dev.serial) != null ? _a : "", void 0);
        }
      });
      tracker.on("error", (e) => this.log.debug(`tracker: ${(0, import_device.errorText)(e)}`));
      if (this.serverOk !== true) {
        this.log.info(`Connected to adb server ${this.serverHost}:${this.serverPort}`);
      }
      this.serverOk = true;
      await this.setState("info.connection", true, true);
      return true;
    } catch (e) {
      const msg = (0, import_device.errorText)(e);
      if (this.serverOk !== false) {
        this.log.error(
          /ENOENT/.test(msg) ? 'adb program not found. Install it (Debian/Ubuntu: "sudo apt install adb") or enter its path in the settings.' : `adb server ${this.serverHost}:${this.serverPort} not reachable: ${msg}`
        );
      }
      this.serverOk = false;
      await this.setState("info.connection", false, true);
      return false;
    }
  }
  /**
   * Forwards a change of the adb device list to the device.
   *
   * @param serial adb serial
   * @param type device type or service type
   */
  async onTracker(serial, type) {
    this.log.debug(`adb: ${serial} ${type != null ? type : "removed"}`);
    for (const dev of this.devices) {
      if (dev.owns(serial)) {
        await dev.onTracker(serial, type);
      }
    }
  }
  /**
   * Creates or updates the objects of a device.
   *
   * @param dev device
   */
  async createDeviceObjects(dev) {
    var _a;
    await this.extendObject(dev.objectId, {
      type: "device",
      common: { name: dev.name, statusStates: { onlineId: `${this.namespace}.${dev.stateId("connection")}` } },
      native: { ip: dev.ip, port: (_a = dev.fixedPort) != null ? _a : null }
    });
    for (const [id, common] of Object.entries(import_device.DEVICE_STATES)) {
      await this.extendObject(dev.stateId(id), { type: "state", common, native: {} });
    }
  }
  /**
   * Runs commands written to device states.
   *
   * @param id state id
   * @param state new state
   */
  async onStateChange(id, state) {
    var _a;
    if (!state || state.ack) {
      return;
    }
    const parts = id.split(".");
    const name = parts.pop();
    const objectId = parts.pop();
    const dev = this.devices.find((d) => d.objectId === objectId);
    if (!dev || !((_a = import_device.DEVICE_STATES[name]) == null ? void 0 : _a.write)) {
      return;
    }
    await dev.command(name, state.val);
    if (import_device.DEVICE_STATES[name].role !== "button") {
      await this.setState(id, state.val, true);
    }
  }
  /**
   * Answers requests from the settings page.
   *
   * @param obj message
   */
  async onMessage(obj) {
    if (!obj || typeof obj.message !== "object" || !obj.callback) {
      return;
    }
    const msg = obj.message;
    let answer;
    try {
      switch (obj.command) {
        case "pair":
          answer = await this.pairWithCode(msg);
          break;
        case "qrCode":
          this.sendTo(obj.from, obj.command, this.qrCode().text, obj.callback);
          return;
        case "qrPair":
          answer = await this.pairWithQr(msg);
          break;
        case "discover":
          answer = await this.discover(msg);
          break;
        default:
          answer = { error: `Unknown command ${obj.command}` };
      }
    } catch (e) {
      answer = { error: (0, import_device.errorText)(e) };
    }
    this.sendTo(obj.from, obj.command, answer, obj.callback);
  }
  /**
   * Pairs with the 6-digit code ("Pair device with pairing code").
   *
   * @param msg ip, port (optional), code, devices from the form
   */
  async pairWithCode(msg) {
    const ip = typeof msg.ip === "string" ? msg.ip.trim() : "";
    const code = (0, import_util.normalizePairingCode)(msg.code);
    if (!ip) {
      return { error: "Enter the IP address of the device" };
    }
    if (!(0, import_util.isValidPairingCode)(code)) {
      return { error: "The pairing code has 6 digits" };
    }
    let port = (0, import_util.parsePort)(msg.port);
    if (!port) {
      const found = await this.discovery.waitForPairing((s) => s.ip === ip, 8e3);
      port = found == null ? void 0 : found.port;
    }
    if (!port) {
      return {
        error: "Pairing port not found. Keep the pairing dialog open on the device, or enter the port shown there."
      };
    }
    await this.pair(ip, port, code);
    return this.pairedAnswer(ip, msg.devices);
  }
  /**
   * Creates the QR code text for "Pair device with QR code" and starts waiting for the device in the background,
   * so the device is paired as soon as it has scanned the code.
   */
  qrCode() {
    if (!this.qr || this.qr.done || Date.now() - this.qr.created > 10 * 6e4) {
      const qr = {
        name: `iobroker-${(0, import_node_crypto.randomBytes)(3).toString("hex")}`,
        password: String((0, import_node_crypto.randomInt)(1e5, 1e6)),
        created: Date.now(),
        listeners: []
      };
      this.qr = qr;
      void this.qrBackground(qr);
    }
    return { text: (0, import_util.pairingQrText)(this.qr.name, this.qr.password) };
  }
  /**
   * Waits up to 10 minutes for the device that scans the QR code and pairs it.
   *
   * @param qr QR code data
   */
  async qrBackground(qr) {
    const found = await this.discovery.waitForPairing((s) => s.name === qr.name, 10 * 6e4);
    if (this.qr !== qr) {
      return;
    }
    if (!found) {
      qr.done = { error: "No device has scanned the QR code" };
    } else {
      this.log.info(`${found.ip} has scanned the QR code, pairing`);
      try {
        await this.pair(found.ip, found.port, qr.password);
        qr.done = { ip: found.ip };
      } catch (e) {
        qr.done = { error: (0, import_device.errorText)(e) };
        this.log.warn(`Pairing with QR code failed: ${qr.done.error}`);
      }
    }
    if (qr.listeners.length) {
      qr.listeners.forEach((l) => l(qr.done));
      qr.listeners = [];
    } else if (qr.done.ip) {
      await this.addDeviceToConfig(qr.done.ip);
    }
  }
  /**
   * Adds a paired device to the saved configuration (restarts the adapter).
   *
   * @param ip device IP address
   */
  async addDeviceToConfig(ip) {
    var _a;
    const devices = (_a = this.config.devices) != null ? _a : [];
    if (devices.some((d) => String(d.ip).trim() === ip)) {
      return;
    }
    const entry = this.pairedAnswer(ip, devices).native;
    this.log.info(`Adding paired device ${ip} to the device list`);
    await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, { native: { devices: entry.devices } });
  }
  /**
   * Answer for "wait for the device": result of the QR pairing, waits up to 60 seconds.
   *
   * @param msg devices from the form
   */
  async pairWithQr(msg) {
    var _a;
    const qr = this.qr;
    if (!qr) {
      return { error: "Show the QR code first" };
    }
    const result = (_a = qr.done) != null ? _a : await new Promise((resolve) => {
      let timer = void 0;
      const listener = (r) => {
        this.clearTimeout(timer);
        resolve(r);
      };
      timer = this.setTimeout(() => {
        qr.listeners = qr.listeners.filter((l) => l !== listener);
        resolve({ error: "No device has scanned the QR code within 60 seconds" });
      }, 6e4);
      qr.listeners.push(listener);
    });
    if (!result.ip) {
      return { error: result.error };
    }
    return this.pairedAnswer(result.ip, msg.devices);
  }
  /**
   * Sends the pairing request to the adb server.
   *
   * @param ip device IP address
   * @param port pairing port
   * @param code pairing code or password
   */
  async pair(ip, port, code) {
    await this.client.version();
    const answer = await (0, import_adbHost.hostRequest)(this.serverHost, this.serverPort, `host:pair:${code}:${ip}:${port}`, 3e4);
    this.log.info(`Pairing ${ip}:${port}: ${answer}`);
    if (!(0, import_util.pairSucceeded)(answer)) {
      throw new Error(answer || "Pairing failed");
    }
  }
  /**
   * Answer after pairing: adds the device to the list in the form, if missing.
   *
   * @param ip device IP
   * @param formDevices device list currently shown in the form
   */
  pairedAnswer(ip, formDevices) {
    var _a;
    const devices = Array.isArray(formDevices) ? formDevices : [...(_a = this.config.devices) != null ? _a : []];
    const known = devices.some((d) => String(d.ip).trim() === ip);
    if (known) {
      return { result: "paired", args: [ip] };
    }
    const found = this.discovery.devices().find((s) => s.ip === ip);
    const name = (found == null ? void 0 : found.name.replace(/^adb-/, "").replace(/-[^-]+$/, "")) || ip;
    return {
      result: "pairedAdded",
      args: [ip],
      native: { devices: [...devices, { enabled: true, name, ip, port: "" }] }
    };
  }
  /**
   * Lists devices with wireless debugging in the network.
   *
   * @param _msg unused
   */
  async discover(_msg) {
    this.discovery.refresh();
    await this.delay(3e3);
    const list = this.discovery.devices();
    if (!list.length) {
      return { result: "noneFound" };
    }
    return {
      result: "found",
      args: [list.map((s) => `${s.ip} (port ${s.port}, ${s.name})`).join("\n")]
    };
  }
  /**
   * Stops everything.
   *
   * @param callback called when done
   */
  async onUnload(callback) {
    var _a, _b;
    try {
      if (this.timer) {
        this.clearInterval(this.timer);
      }
      (_a = this.tracker) == null ? void 0 : _a.end();
      (_b = this.discovery) == null ? void 0 : _b.stop();
      await Promise.all(this.devices.map((d) => d.close()));
    } finally {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new AdbAdapter(options);
} else {
  (() => new AdbAdapter())();
}
//# sourceMappingURL=main.js.map
