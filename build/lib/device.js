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
    name: {
      en: "Connected",
      de: "Verbunden",
      ru: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      pt: "Conectado",
      nl: "Verbonden",
      fr: "Connect\xE9",
      it: "Connesso",
      es: "Conectado",
      pl: "Po\u0142\u0105czono",
      uk: "\u041F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      "zh-cn": "\u5DF2\u8FDE\u63A5"
    },
    type: "boolean",
    role: "indicator.reachable",
    read: true,
    write: false,
    def: false
  },
  status: {
    name: {
      en: "Connection status",
      de: "Verbindungsstatus",
      ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F",
      pt: "Estado da conex\xE3o",
      nl: "Verbindingsstatus",
      fr: "\xC9tat de la connexion",
      it: "Stato della connessione",
      es: "Estado de la conexi\xF3n",
      pl: "Stan po\u0142\u0105czenia",
      uk: "\u0421\u0442\u0430\u043D \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F",
      "zh-cn": "\u8FDE\u63A5\u72B6\u6001"
    },
    type: "string",
    role: "info.status",
    read: true,
    write: false,
    def: ""
  },
  port: {
    name: {
      en: "Current port",
      de: "Aktueller Port",
      ru: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043E\u0440\u0442",
      pt: "Porta atual",
      nl: "Huidige poort",
      fr: "Port actuel",
      it: "Porta attuale",
      es: "Puerto actual",
      pl: "Bie\u017C\u0105cy port",
      uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u043F\u043E\u0440\u0442",
      "zh-cn": "\u5F53\u524D\u7AEF\u53E3"
    },
    type: "number",
    role: "info.port",
    read: true,
    write: false
  },
  model: {
    name: {
      en: "Model",
      de: "Modell",
      ru: "\u041C\u043E\u0434\u0435\u043B\u044C",
      pt: "Modelo",
      nl: "Model",
      fr: "Mod\xE8le",
      it: "Modello",
      es: "Modelo",
      pl: "Model",
      uk: "\u041C\u043E\u0434\u0435\u043B\u044C",
      "zh-cn": "\u578B\u53F7"
    },
    type: "string",
    role: "info.model",
    read: true,
    write: false
  },
  androidVersion: {
    name: {
      en: "Android version",
      de: "Android-Version",
      ru: "\u0412\u0435\u0440\u0441\u0438\u044F Android",
      pt: "Vers\xE3o do Android",
      nl: "Android-versie",
      fr: "Version Android",
      it: "Versione Android",
      es: "Versi\xF3n de Android",
      pl: "Wersja Androida",
      uk: "\u0412\u0435\u0440\u0441\u0456\u044F Android",
      "zh-cn": "Android \u7248\u672C"
    },
    type: "string",
    role: "info.firmware",
    read: true,
    write: false
  },
  shell: {
    name: {
      en: "Shell command",
      de: "Shell-Befehl",
      ru: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0431\u043E\u043B\u043E\u0447\u043A\u0438",
      pt: "Comando shell",
      nl: "Shell-opdracht",
      fr: "Commande shell",
      it: "Comando shell",
      es: "Comando de shell",
      pl: "Polecenie pow\u0142oki",
      uk: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0431\u043E\u043B\u043E\u043D\u043A\u0438",
      "zh-cn": "Shell \u547D\u4EE4"
    },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: 'e.g. "input keyevent 26"; the answer is written to "result"'
  },
  keyevent: {
    name: {
      en: "Send key",
      de: "Taste senden",
      ru: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043A\u043B\u0430\u0432\u0438\u0448\u0443",
      pt: "Enviar tecla",
      nl: "Toets sturen",
      fr: "Envoyer une touche",
      it: "Invia tasto",
      es: "Enviar tecla",
      pl: "Wy\u015Blij klawisz",
      uk: "\u041D\u0430\u0434\u0456\u0441\u043B\u0430\u0442\u0438 \u043A\u043B\u0430\u0432\u0456\u0448\u0443",
      "zh-cn": "\u53D1\u9001\u6309\u952E"
    },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Key code or name, e.g. 26, POWER, HOME, BACK, VOLUME_UP"
  },
  result: {
    name: {
      en: "Command result",
      de: "Ergebnis des Befehls",
      ru: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B",
      pt: "Resultado do comando",
      nl: "Resultaat van de opdracht",
      fr: "R\xE9sultat de la commande",
      it: "Risultato del comando",
      es: "Resultado del comando",
      pl: "Wynik polecenia",
      uk: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u0438",
      "zh-cn": "\u547D\u4EE4\u7ED3\u679C"
    },
    type: "string",
    role: "text",
    read: true,
    write: false
  },
  startApp: {
    name: {
      en: "Start an app",
      de: "App starten",
      ru: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
      pt: "Iniciar um app",
      nl: "App starten",
      fr: "Lancer une application",
      it: "Avvia un'app",
      es: "Iniciar una app",
      pl: "Uruchom aplikacj\u0119",
      uk: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A",
      "zh-cn": "\u542F\u52A8\u5E94\u7528"
    },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Component like com.example.app/.MainActivity"
  },
  stopApp: {
    name: {
      en: "Stop an app",
      de: "App beenden",
      ru: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
      pt: "Parar um app",
      nl: "App stoppen",
      fr: "Arr\xEAter une application",
      it: "Arresta un'app",
      es: "Detener una app",
      pl: "Zatrzymaj aplikacj\u0119",
      uk: "\u0417\u0443\u043F\u0438\u043D\u0438\u0442\u0438 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A",
      "zh-cn": "\u505C\u6B62\u5E94\u7528"
    },
    type: "string",
    role: "text",
    read: true,
    write: true,
    desc: "Package name like com.example.app"
  },
  reboot: {
    name: {
      en: "Reboot device",
      de: "Ger\xE4t neu starten",
      ru: "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",
      pt: "Reiniciar dispositivo",
      nl: "Apparaat herstarten",
      fr: "Red\xE9marrer l'appareil",
      it: "Riavvia dispositivo",
      es: "Reiniciar dispositivo",
      pl: "Uruchom ponownie urz\u0105dzenie",
      uk: "\u041F\u0435\u0440\u0435\u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439",
      "zh-cn": "\u91CD\u542F\u8BBE\u5907"
    },
    type: "boolean",
    role: "button",
    read: false,
    write: true
  },
  screencap: {
    name: {
      en: "Take screenshot",
      de: "Bildschirmfoto aufnehmen",
      ru: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0441\u043D\u0438\u043C\u043E\u043A \u044D\u043A\u0440\u0430\u043D\u0430",
      pt: "Capturar tela",
      nl: "Schermafbeelding maken",
      fr: "Faire une capture d'\xE9cran",
      it: "Cattura schermata",
      es: "Hacer captura de pantalla",
      pl: "Zr\xF3b zrzut ekranu",
      uk: "\u0417\u0440\u043E\u0431\u0438\u0442\u0438 \u0437\u043D\u0456\u043C\u043E\u043A \u0435\u043A\u0440\u0430\u043D\u0430",
      "zh-cn": "\u622A\u5C4F"
    },
    type: "boolean",
    role: "button",
    read: false,
    write: true,
    desc: 'Saved as file in the adapter folder, see "result"'
  }
};
const WIRELESS_STATES = {
  hideNotification: {
    name: {
      en: "Hide the debugging notification",
      de: "Debugging-Benachrichtigung ausblenden",
      ru: "\u0421\u043A\u0440\u044B\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043E\u0431 \u043E\u0442\u043B\u0430\u0434\u043A\u0435",
      pt: "Ocultar a notifica\xE7\xE3o de depura\xE7\xE3o",
      nl: "Debugmelding verbergen",
      fr: "Masquer la notification de d\xE9bogage",
      it: "Nascondi la notifica di debug",
      es: "Ocultar la notificaci\xF3n de depuraci\xF3n",
      pl: "Ukryj powiadomienie o debugowaniu",
      uk: "\u041F\u0440\u0438\u0445\u043E\u0432\u0430\u0442\u0438 \u0441\u043F\u043E\u0432\u0456\u0449\u0435\u043D\u043D\u044F \u043F\u0440\u043E \u043D\u0430\u043B\u0430\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F",
      "zh-cn": "\u9690\u85CF\u8C03\u8BD5\u901A\u77E5"
    },
    type: "boolean",
    role: "switch.setting",
    read: true,
    write: true,
    def: false,
    desc: 'true: the notification "Wireless debugging connected" is snoozed and snoozed again after every connection; false: shown again'
  }
};
const SNOOZE_MS = 365 * 24 * 3600 * 1e3;
const DEFAULT_NOTIFICATION_KEY = "-1|android|62|null|1000";
const SHELL_MS = 12e4;
const WAIT_MS = 1e4;
class AndroidDevice {
  /**
   * @param host adapter
   * @param client adb client
   * @param discovery mDNS discovery
   * @param cfg device configuration
   * @param objectId object id to use instead of the default (devices of version 0.0.x)
   */
  constructor(host, client, discovery, cfg, objectId) {
    this.host = host;
    this.client = client;
    this.discovery = discovery;
    this.ip = cfg.ip;
    this.name = cfg.name || cfg.ip;
    this.fixedPort = (0, import_util.parsePort)(cfg.port);
    this.objectId = objectId != null ? objectId : (0, import_util.deviceObjectId)(this.ip, this.fixedPort);
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
  /** Apps installed on the device (read when connected) */
  apps = [];
  notifyTimer;
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
      await this.withTimeout(this.client.connect(this.ip, port), WAIT_MS, "connect timeout");
      this.serial = serial;
      await this.host.setState(this.stateId("port"), { val: port, ack: true });
      await this.withTimeout(this.device().waitForDevice(), WAIT_MS, "device did not answer");
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
      this.host.clearTimeout(this.notifyTimer);
      this.notifyTimer = this.host.setTimeout(() => void this.applyNotification(), 3e3);
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
    await this.readApps();
  }
  /** Reads the installed apps once per connection, for the app selection in the settings. */
  async readApps() {
    try {
      this.apps = (0, import_util.parsePackages)(await this.readShell("pm list packages -3 --user 0")).sort();
    } catch (e) {
      this.host.log.debug(`${this.label}: could not read the app list: ${errorText(e)}`);
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
    const out = await this.readShell(command);
    await this.setResult(out || "ok");
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
    return this.readShell(command);
  }
  /**
   * Runs a shell command with a time limit and returns its trimmed output.
   *
   * @param command shell command
   */
  async readShell(command) {
    const stream = await this.device().shell(command);
    try {
      const out = await this.withTimeout(
        import_adbkit.Adb.util.readAll(stream),
        SHELL_MS,
        "command did not finish within 2 minutes"
      );
      return out.toString().trim();
    } finally {
      stream.destroy();
    }
  }
  /**
   * Rejects if the promise does not settle in time.
   *
   * @param p promise
   * @param ms time limit in ms
   * @param msg error text
   */
  withTimeout(p, ms, msg) {
    return new Promise((resolve, reject) => {
      const t = this.host.setTimeout(() => reject(new Error(msg)), ms);
      p.then(
        (v) => {
          this.host.clearTimeout(t);
          resolve(v);
        },
        (e) => {
          this.host.clearTimeout(t);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      );
    });
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
    this.host.clearTimeout(this.notifyTimer);
    if (this.serial) {
      await this.client.disconnect(this.ip, (0, import_util.portOfSerial)(this.serial)).catch(() => void 0);
    }
  }
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
