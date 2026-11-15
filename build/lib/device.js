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
var device_exports = {};
__export(device_exports, {
  AndroidDevice: () => AndroidDevice,
  DEVICE_STATES: () => DEVICE_STATES,
  WIRELESS_STATES: () => WIRELESS_STATES,
  errorText: () => errorText
});
module.exports = __toCommonJS(device_exports);
var import_adbkit = require("@devicefarmer/adbkit");
var import_util = require("./util");
const DEVICE_STATES = {
  connection: {
    name: { en: "Connected", de: "Verbunden" },
    type: "boolean",
    role: "indicator.connected",
    read: true,
    write: false,
    def: false
  },
  status: {
    name: { en: "Connection status", de: "Verbindungsstatus" },
    type: "string",
    role: "text",
    read: true,
    write: false,
    def: ""
  },
  port: {
    name: { en: "Current port", de: "Aktueller Port" },
    type: "number",
    role: "value",
    read: true,
    write: false
  },
  model: {
    name: { en: "Model", de: "Modell" },
    type: "string",
    role: "text",
    read: true,
    write: false
  },
  androidVersion: {
    name: { en: "Android version", de: "Android-Version" },
    type: "string",
    role: "text",
    read: true,
    write: false
  },
  shell: {
    name: { en: "Shell command", de: "Shell-Befehl" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: 'e.g. "input keyevent 26"; the answer is written to "result"'
  },
  keyevent: {
    name: { en: "Send key", de: "Taste senden" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Key code or name, e.g. 26, POWER, HOME, BACK, VOLUME_UP"
  },
  result: {
    name: { en: "Command result", de: "Ergebnis des Befehls" },
    type: "string",
    role: "text",
    read: true,
    write: false
  },
  startApp: {
    name: { en: "Start an app", de: "App starten" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Component like com.example.app/.MainActivity"
  },
  stopApp: {
    name: { en: "Stop an app", de: "App beenden" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Package name like com.example.app"
  },
  reboot: {
    name: { en: "Reboot device", de: "Ger\xE4t neu starten" },
    type: "boolean",
    role: "button",
    read: false,
    write: true
  },
  screencap: {
    name: { en: "Take screenshot", de: "Bildschirmfoto aufnehmen" },
    type: "boolean",
    role: "button",
    read: false,
    write: true,
    desc: 'Saved as file in the adapter folder, see "result"'
  }
};
const WIRELESS_STATES = {
  hideNotification: {
    name: { en: "Hide the debugging notification", de: "Debugging-Benachrichtigung ausblenden" },
    type: "boolean",
    role: "switch",
    read: true,
    write: true,
    def: false,
    desc: 'true: the notification "Wireless debugging connected" is snoozed and snoozed again after every connection; false: shown again'
  }
};
const SNOOZE_MS = 365 * 24 * 3600 * 1e3;
const DEFAULT_NOTIFICATION_KEY = "-1|android|62|null|1000";
const WAIT_MS = 1e4;
class AndroidDevice {
  /**
   * @param host adapter
   * @param client adb client
   * @param discovery mDNS discovery
   * @param cfg device configuration
   */
  constructor(host, client, discovery, cfg) {
    this.host = host;
    this.client = client;
    this.discovery = discovery;
    this.ip = cfg.ip;
    this.name = cfg.name || cfg.ip;
    this.fixedPort = (0, import_util.parsePort)(cfg.port);
    this.objectId = (0, import_util.deviceObjectId)(this.ip, this.fixedPort);
  }
  ip;
  name;
  fixedPort;
  objectId;
  /** adb serial of the current connection, e.g. `192.168.1.5:41235` */
  serial;
  connected = false;
  busy;
  lastStatus = "";
  infoRead = false;
  /** Hide the debugging notification */
  hideNotification = false;
  /** Text for logs */
  get label() {
    return `${this.name} (${this.ip}${this.fixedPort ? `:${this.fixedPort}` : ""})`;
  }
  /**
   * Checks whether an adb serial belongs to this device.
   *
   * @param serial adb serial
   */
  owns(serial) {
    if (serial === this.serial) {
      return true;
    }
    if ((0, import_util.hostOfSerial)(serial) !== this.ip) {
      return false;
    }
    return this.fixedPort ? (0, import_util.portOfSerial)(serial) === this.fixedPort : true;
  }
  /**
   * Connects if not connected yet. Calls at the same time share one attempt.
   *
   * @param quiet do not log failures as warning (periodic reconnect)
   */
  ensureConnected(quiet = false) {
    var _a;
    if (this.connected && this.serial) {
      return Promise.resolve(true);
    }
    (_a = this.busy) != null ? _a : this.busy = this.connect(quiet).finally(() => this.busy = void 0);
    return this.busy;
  }
  /**
   * Connects to the device, looking up the port if needed.
   *
   * @param quiet log only at debug level
   */
  async connect(quiet) {
    let port = this.fixedPort;
    if (!port) {
      port = this.discovery.connectPort(this.ip);
      if (!port) {
        this.discovery.refresh();
        await this.setStatus(
          "Wireless debugging not found in the network (switched off or device asleep?)",
          quiet
        );
        return false;
      }
    }
    const serial = `${this.ip}:${port}`;
    if (this.serial && this.serial !== serial) {
      await this.client.disconnect(this.ip, (0, import_util.portOfSerial)(this.serial)).catch(() => void 0);
    }
    try {
      await withTimeout(this.client.connect(this.ip, port), WAIT_MS, "connect timeout");
      this.serial = serial;
      await this.host.setState(this.stateId("port"), { val: port, ack: true });
      await withTimeout(this.device().waitForDevice(), WAIT_MS, "device did not answer");
      await this.onConnected();
      return true;
    } catch (e) {
      const msg = errorText(e);
      await this.setStatus(
        /unauthorized|did not answer/i.test(msg) ? 'Device does not allow the connection: confirm "Allow debugging" on the device' : `Can not connect: ${msg}`,
        quiet
      );
      await this.setConnected(false);
      return false;
    }
  }
  /**
   * Called by the adapter when the adb server reports a change of this device.
   *
   * @param serial adb serial
   * @param type device type from the adb server
   */
  async onTracker(serial, type) {
    if (type === "device") {
      this.serial = serial;
      const p = (0, import_util.portOfSerial)(serial);
      if (p) {
        await this.host.setState(this.stateId("port"), { val: p, ack: true });
      }
      await this.onConnected();
    } else if (serial === this.serial || !this.serial) {
      if (type === "unauthorized") {
        await this.setStatus('Confirm "Allow debugging" on the device', false);
      } else {
        await this.setStatus(type ? `Device is ${type}` : "Disconnected", true);
      }
      await this.setConnected(false);
    }
  }
  /** Marks the device connected and reads its info once. */
  async onConnected() {
    await this.setConnected(true);
    await this.setStatus("Connected", true);
    if (!this.infoRead) {
      await this.readInfo();
    }
    if (this.hideNotification) {
      setTimeout(() => void this.applyNotification(), 3e3);
    }
  }
  /**
   * Switches hiding of the debugging notification on or off.
   *
   * @param hide true to hide
   */
  async setHideNotification(hide) {
    this.hideNotification = hide;
    if (this.connected) {
      await this.applyNotification();
    }
  }
  /** Snoozes or unsnoozes the debugging notification, depending on the setting. */
  async applyNotification() {
    if (this.fixedPort || !this.connected) {
      return;
    }
    try {
      const keys = /* @__PURE__ */ new Set([DEFAULT_NOTIFICATION_KEY]);
      const dump = await this.run(
        "dumpsys notification --noredact | grep 'channel=DEVELOPER_IMPORTANT' | grep -o 'key=[^ ]*'"
      );
      for (const line of dump.split(/\r?\n/)) {
        const key = line.trim().replace(/^key=/, "").replace(/:$/, "");
        if (/^-?\d+\|android\|\d+\|/.test(key)) {
          keys.add(key);
        }
      }
      for (const key of keys) {
        const cmd = this.hideNotification ? `cmd notification snooze --for ${SNOOZE_MS} '${key}'` : `cmd notification unsnooze '${key}'`;
        await this.run(cmd);
      }
      this.host.log.debug(`${this.label}: debugging notification ${this.hideNotification ? "snoozed" : "shown"}`);
    } catch (e) {
      this.host.log.warn(`${this.label}: could not change the debugging notification: ${errorText(e)}`);
    }
  }
  /** Reads model and Android version. */
  async readInfo() {
    var _a;
    try {
      const p = await this.device().getProperties();
      const model = [p["ro.product.manufacturer"], p["ro.product.model"]].filter(Boolean).join(" ");
      await this.host.setState(this.stateId("model"), { val: model, ack: true });
      await this.host.setState(this.stateId("androidVersion"), {
        val: (_a = p["ro.build.version.release"]) != null ? _a : "",
        ack: true
      });
      this.infoRead = true;
    } catch (e) {
      this.host.log.debug(`${this.label}: could not read device info: ${errorText(e)}`);
    }
  }
  /**
   * Writes the connection state.
   *
   * @param on connected or not
   */
  async setConnected(on) {
    if (this.connected !== on) {
      this.connected = on;
      if (on) {
        this.host.log.info(`${this.label} connected`);
      }
    }
    await this.host.setState(this.stateId("connection"), { val: on, ack: true });
  }
  /**
   * Writes the status text and logs changes once.
   *
   * @param text text to write
   * @param quiet log only at debug level
   */
  async setStatus(text, quiet) {
    if (text !== this.lastStatus) {
      this.lastStatus = text;
      if (!quiet) {
        this.host.log.warn(`${this.label}: ${text}`);
      } else {
        this.host.log.debug(`${this.label}: ${text}`);
      }
    }
    await this.host.setState(this.stateId("status"), { val: text, ack: true });
  }
  /** adb client for the current connection. */
  device() {
    if (!this.serial) {
      throw new Error("not connected");
    }
    return this.client.getDevice(this.serial);
  }
  /**
   * Runs a command and writes the answer to "result".
   *
   * @param state name of the state that was written
   * @param value value that was written
   */
  async command(state, value) {
    const text = String(value != null ? value : "").trim();
    if (!await this.ensureConnected()) {
      await this.setResult(`error: ${this.lastStatus || "not connected"}`);
      return;
    }
    try {
      switch (state) {
        case "shell":
          await this.shell((0, import_util.cleanShellCommand)(text));
          break;
        case "keyevent":
          if (text) {
            const key = /^\d+$/.test(text) ? text : `KEYCODE_${text.toUpperCase().replace(/^KEYCODE_/, "")}`;
            await this.shell(`input keyevent ${key}`);
          }
          break;
        case "startApp":
          if (text) {
            await this.shell(`am start -n ${(0, import_util.startComponent)(text)}`);
          }
          break;
        case "stopApp":
          if (text) {
            await this.shell(`am force-stop ${(0, import_util.stopPackage)(text)}`);
          }
          break;
        case "reboot":
          await this.device().reboot();
          await this.setResult("reboot started");
          this.infoRead = false;
          break;
        case "screencap":
          await this.screencap();
          break;
      }
    } catch (e) {
      const msg = errorText(e);
      this.host.log.error(`${this.label}: ${state} failed: ${msg}`);
      await this.setResult(`error: ${msg}`);
      if (/closed|ECONNRESET|not found|offline/i.test(msg)) {
        await this.setConnected(false);
      }
    }
  }
  /**
   * Runs a shell command and stores the answer.
   *
   * @param command shell command
   */
  async shell(command) {
    if (!command) {
      return;
    }
    const out = await import_adbkit.Adb.util.readAll(await this.device().shell(command));
    await this.setResult(out.toString().trim() || "ok");
  }
  /**
   * Runs a shell command and returns its output, without writing "result".
   *
   * @param command shell command
   */
  async run(command) {
    if (!await this.ensureConnected()) {
      throw new Error(this.lastStatus || "not connected");
    }
    const out = await import_adbkit.Adb.util.readAll(await this.device().shell(command));
    return out.toString().trim();
  }
  /** Takes a screenshot and stores it as file. */
  async screencap() {
    const png = (0, import_util.extractPng)(await import_adbkit.Adb.util.readAll(await this.device().screencap()));
    const file = `${this.objectId}.png`;
    await this.host.writeFileAsync(this.host.namespace, file, png);
    await this.host.writeFileAsync(this.host.namespace, "screenshot.png", png);
    await this.setResult(`screenshot saved: /${this.host.namespace}/${file}`);
  }
  /**
   * Writes the result state.
   *
   * @param text text to write
   */
  async setResult(text) {
    await this.host.setState(this.stateId("result"), { val: text, ack: true });
  }
  /**
   * Full id of a state of this device.
   *
   * @param state state name
   */
  stateId(state) {
    return `${this.objectId}.${state}`;
  }
  /** Closes the connection */
  async close() {
    if (this.serial) {
      await this.client.disconnect(this.ip, (0, import_util.portOfSerial)(this.serial)).catch(() => void 0);
    }
  }
}
function withTimeout(p, ms, msg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}
function errorText(e) {
  return e instanceof Error ? e.message : String(e);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AndroidDevice,
  DEVICE_STATES,
  WIRELESS_STATES,
  errorText
});
//# sourceMappingURL=device.js.map
