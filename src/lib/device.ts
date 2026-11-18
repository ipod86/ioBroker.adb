import { Adb, type Client, type DeviceClient } from '@devicefarmer/adbkit';
import type { Discovery } from './discovery';
import { findOpenPorts } from './portScan';
import {
	cleanShellCommand,
	deviceIdOf,
	extractPng,
	hostOfSerial,
	infoCommand,
	parseInfo,
	type DeviceInfo,
	parsePackages,
	parsePort,
	portOfSerial,
	startComponent,
	stopPackage,
	type DeviceConfig,
} from './util';

/** States of each device. The ids of version 0.0.x are kept, so existing scripts keep working. */
export const DEVICE_STATES: Record<string, ioBroker.StateCommon> = {
	connection: {
		name: {
			en: 'Connected',
			de: 'Verbunden',
			ru: 'Подключено',
			pt: 'Conectado',
			nl: 'Verbonden',
			fr: 'Connecté',
			it: 'Connesso',
			es: 'Conectado',
			pl: 'Połączono',
			uk: 'Підключено',
			'zh-cn': '已连接',
		},
		type: 'boolean',
		role: 'indicator.reachable',
		read: true,
		write: false,
		def: false,
	},
	status: {
		name: {
			en: 'Connection status',
			de: 'Verbindungsstatus',
			ru: 'Состояние подключения',
			pt: 'Estado da conexão',
			nl: 'Verbindingsstatus',
			fr: 'État de la connexion',
			it: 'Stato della connessione',
			es: 'Estado de la conexión',
			pl: 'Stan połączenia',
			uk: 'Стан підключення',
			'zh-cn': '连接状态',
		},
		type: 'string',
		role: 'info.status',
		read: true,
		write: false,
		def: '',
	},
	port: {
		name: {
			en: 'Current port',
			de: 'Aktueller Port',
			ru: 'Текущий порт',
			pt: 'Porta atual',
			nl: 'Huidige poort',
			fr: 'Port actuel',
			it: 'Porta attuale',
			es: 'Puerto actual',
			pl: 'Bieżący port',
			uk: 'Поточний порт',
			'zh-cn': '当前端口',
		},
		type: 'number',
		role: 'info.port',
		read: true,
		write: false,
	},
	model: {
		name: {
			en: 'Model',
			de: 'Modell',
			ru: 'Модель',
			pt: 'Modelo',
			nl: 'Model',
			fr: 'Modèle',
			it: 'Modello',
			es: 'Modelo',
			pl: 'Model',
			uk: 'Модель',
			'zh-cn': '型号',
		},
		type: 'string',
		role: 'info.model',
		read: true,
		write: false,
	},
	androidVersion: {
		name: {
			en: 'Android version',
			de: 'Android-Version',
			ru: 'Версия Android',
			pt: 'Versão do Android',
			nl: 'Android-versie',
			fr: 'Version Android',
			it: 'Versione Android',
			es: 'Versión de Android',
			pl: 'Wersja Androida',
			uk: 'Версія Android',
			'zh-cn': 'Android 版本',
		},
		type: 'string',
		role: 'info.firmware',
		read: true,
		write: false,
	},
	shell: {
		name: {
			en: 'Shell command',
			de: 'Shell-Befehl',
			ru: 'Команда оболочки',
			pt: 'Comando shell',
			nl: 'Shell-opdracht',
			fr: 'Commande shell',
			it: 'Comando shell',
			es: 'Comando de shell',
			pl: 'Polecenie powłoki',
			uk: 'Команда оболонки',
			'zh-cn': 'Shell 命令',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'e.g. "input keyevent 26"; the answer is written to "result"',
	},
	keyevent: {
		name: {
			en: 'Send key',
			de: 'Taste senden',
			ru: 'Отправить клавишу',
			pt: 'Enviar tecla',
			nl: 'Toets sturen',
			fr: 'Envoyer une touche',
			it: 'Invia tasto',
			es: 'Enviar tecla',
			pl: 'Wyślij klawisz',
			uk: 'Надіслати клавішу',
			'zh-cn': '发送按键',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Key code or name, e.g. 26, POWER, HOME, BACK, VOLUME_UP',
	},
	result: {
		name: {
			en: 'Command result',
			de: 'Ergebnis des Befehls',
			ru: 'Результат команды',
			pt: 'Resultado do comando',
			nl: 'Resultaat van de opdracht',
			fr: 'Résultat de la commande',
			it: 'Risultato del comando',
			es: 'Resultado del comando',
			pl: 'Wynik polecenia',
			uk: 'Результат команди',
			'zh-cn': '命令结果',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	startApp: {
		name: {
			en: 'Start an app',
			de: 'App starten',
			ru: 'Запустить приложение',
			pt: 'Iniciar um app',
			nl: 'App starten',
			fr: 'Lancer une application',
			it: "Avvia un'app",
			es: 'Iniciar una app',
			pl: 'Uruchom aplikację',
			uk: 'Запустити застосунок',
			'zh-cn': '启动应用',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Component like com.example.app/.MainActivity',
	},
	stopApp: {
		name: {
			en: 'Stop an app',
			de: 'App beenden',
			ru: 'Остановить приложение',
			pt: 'Parar um app',
			nl: 'App stoppen',
			fr: 'Arrêter une application',
			it: "Arresta un'app",
			es: 'Detener una app',
			pl: 'Zatrzymaj aplikację',
			uk: 'Зупинити застосунок',
			'zh-cn': '停止应用',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Package name like com.example.app',
	},
	reboot: {
		name: {
			en: 'Reboot device',
			de: 'Gerät neu starten',
			ru: 'Перезагрузить устройство',
			pt: 'Reiniciar dispositivo',
			nl: 'Apparaat herstarten',
			fr: "Redémarrer l'appareil",
			it: 'Riavvia dispositivo',
			es: 'Reiniciar dispositivo',
			pl: 'Uruchom ponownie urządzenie',
			uk: 'Перезавантажити пристрій',
			'zh-cn': '重启设备',
		},
		type: 'boolean',
		role: 'button',
		read: false,
		write: true,
	},
	screencap: {
		name: {
			en: 'Take screenshot',
			de: 'Bildschirmfoto aufnehmen',
			ru: 'Сделать снимок экрана',
			pt: 'Capturar tela',
			nl: 'Schermafbeelding maken',
			fr: "Faire une capture d'écran",
			it: 'Cattura schermata',
			es: 'Hacer captura de pantalla',
			pl: 'Zrób zrzut ekranu',
			uk: 'Зробити знімок екрана',
			'zh-cn': '截屏',
		},
		type: 'boolean',
		role: 'button',
		read: false,
		write: true,
		desc: 'Saved as file in the adapter folder, see "result"',
	},
};

/** States only for devices with wireless debugging (automatic port) */
export const WIRELESS_STATES: Record<string, ioBroker.StateCommon> = {
	hideNotification: {
		name: {
			en: 'Hide the debugging notification',
			de: 'Debugging-Benachrichtigung ausblenden',
			ru: 'Скрыть уведомление об отладке',
			pt: 'Ocultar a notificação de depuração',
			nl: 'Debugmelding verbergen',
			fr: 'Masquer la notification de débogage',
			it: 'Nascondi la notifica di debug',
			es: 'Ocultar la notificación de depuración',
			pl: 'Ukryj powiadomienie o debugowaniu',
			uk: 'Приховати сповіщення про налагодження',
			'zh-cn': '隐藏调试通知',
		},
		type: 'boolean',
		role: 'switch.setting',
		read: true,
		write: true,
		def: false,
		desc: 'true: the notification "Wireless debugging connected" is snoozed and snoozed again after every connection; false: shown again',
	},
};

/** Snooze time of the debugging notification: one year, renewed after every connection */
const SNOOZE_MS = 365 * 24 * 3600 * 1000;
/** Key of the wireless debugging notification in Android (SystemMessage.NOTE_ADB_WIFI_ACTIVE) */
const DEFAULT_NOTIFICATION_KEY = '-1|android|62|null|1000';

/** Info values read periodically while the device is connected (folder "info" of the device) */
export const INFO_STATES: Record<string, ioBroker.StateCommon> = {
	screenOn: {
		name: {
			en: 'Screen on',
			de: 'Bildschirm an',
			ru: 'Экран включён',
			pt: 'Tela ligada',
			nl: 'Scherm aan',
			fr: 'Écran allumé',
			it: 'Schermo acceso',
			es: 'Pantalla encendida',
			pl: 'Ekran włączony',
			uk: 'Екран увімкнено',
			'zh-cn': '屏幕开启',
		},
		type: 'boolean',
		role: 'indicator',
		read: true,
		write: false,
	},
	currentApp: {
		name: {
			en: 'App in the foreground',
			de: 'App im Vordergrund',
			ru: 'Приложение на переднем плане',
			pt: 'App em primeiro plano',
			nl: 'App op de voorgrond',
			fr: 'Application au premier plan',
			it: 'App in primo piano',
			es: 'App en primer plano',
			pl: 'Aplikacja na pierwszym planie',
			uk: 'Застосунок на передньому плані',
			'zh-cn': '前台应用',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	wifiSsid: {
		name: {
			en: 'Wi-Fi network',
			de: 'WLAN-Netz',
			ru: 'Сеть Wi-Fi',
			pt: 'Rede Wi-Fi',
			nl: 'Wifi-netwerk',
			fr: 'Réseau Wi-Fi',
			it: 'Rete Wi-Fi',
			es: 'Red Wi-Fi',
			pl: 'Sieć Wi-Fi',
			uk: 'Мережа Wi-Fi',
			'zh-cn': 'Wi-Fi 网络',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	wifiRssi: {
		name: {
			en: 'Wi-Fi signal strength',
			de: 'WLAN-Signalstärke',
			ru: 'Уровень сигнала Wi-Fi',
			pt: 'Intensidade do sinal Wi-Fi',
			nl: 'Wifi-signaalsterkte',
			fr: 'Puissance du signal Wi-Fi',
			it: 'Potenza del segnale Wi-Fi',
			es: 'Intensidad de la señal Wi-Fi',
			pl: 'Siła sygnału Wi-Fi',
			uk: 'Рівень сигналу Wi-Fi',
			'zh-cn': 'Wi-Fi 信号强度',
		},
		type: 'number',
		role: 'value.rssi',
		unit: 'dBm',
		read: true,
		write: false,
	},
	doNotDisturb: {
		name: {
			en: 'Do not disturb',
			de: 'Nicht stören',
			ru: 'Не беспокоить',
			pt: 'Não perturbe',
			nl: 'Niet storen',
			fr: 'Ne pas déranger',
			it: 'Non disturbare',
			es: 'No molestar',
			pl: 'Nie przeszkadzać',
			uk: 'Не турбувати',
			'zh-cn': '勿扰模式',
		},
		type: 'boolean',
		role: 'switch.mode.silent',
		read: true,
		write: true,
	},
	storageFree: {
		name: {
			en: 'Free storage',
			de: 'Freier Speicher',
			ru: 'Свободная память',
			pt: 'Armazenamento livre',
			nl: 'Vrije opslag',
			fr: 'Stockage libre',
			it: 'Spazio libero',
			es: 'Almacenamiento libre',
			pl: 'Wolne miejsce',
			uk: 'Вільна пам’ять',
			'zh-cn': '可用存储',
		},
		type: 'number',
		role: 'value',
		unit: 'GB',
		read: true,
		write: false,
	},
};

/** Battery values, only for devices that have a battery */
export const BATTERY_STATES: Record<string, ioBroker.StateCommon> = {
	batteryLevel: {
		name: {
			en: 'Battery level',
			de: 'Akkustand',
			ru: 'Уровень заряда',
			pt: 'Nível da bateria',
			nl: 'Batterijniveau',
			fr: 'Niveau de batterie',
			it: 'Livello batteria',
			es: 'Nivel de batería',
			pl: 'Poziom baterii',
			uk: 'Рівень заряду',
			'zh-cn': '电池电量',
		},
		type: 'number',
		role: 'value.battery',
		unit: '%',
		min: 0,
		max: 100,
		read: true,
		write: false,
	},
	charging: {
		name: {
			en: 'Charging',
			de: 'Lädt',
			ru: 'Заряжается',
			pt: 'Carregando',
			nl: 'Laden',
			fr: 'En charge',
			it: 'In carica',
			es: 'Cargando',
			pl: 'Ładowanie',
			uk: 'Заряджається',
			'zh-cn': '充电中',
		},
		type: 'boolean',
		role: 'indicator',
		read: true,
		write: false,
	},
	chargeSource: {
		name: {
			en: 'Power source',
			de: 'Stromquelle',
			ru: 'Источник питания',
			pt: 'Fonte de energia',
			nl: 'Stroombron',
			fr: "Source d'alimentation",
			it: 'Fonte di alimentazione',
			es: 'Fuente de alimentación',
			pl: 'Źródło zasilania',
			uk: 'Джерело живлення',
			'zh-cn': '电源',
		},
		type: 'string',
		role: 'text',
		read: true,
		write: false,
		states: { none: 'none', ac: 'ac', usb: 'usb', wireless: 'wireless', dock: 'dock' },
	},
	batteryTemperature: {
		name: {
			en: 'Battery temperature',
			de: 'Akkutemperatur',
			ru: 'Температура батареи',
			pt: 'Temperatura da bateria',
			nl: 'Batterijtemperatuur',
			fr: 'Température de la batterie',
			it: 'Temperatura della batteria',
			es: 'Temperatura de la batería',
			pl: 'Temperatura baterii',
			uk: 'Температура батареї',
			'zh-cn': '电池温度',
		},
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		read: true,
		write: false,
	},
};

/** What the device needs from the adapter */
export interface DeviceHost extends Pick<ioBroker.Adapter, 'setTimeout' | 'clearTimeout' | 'extendObject'> {
	namespace: string;
	log: ioBroker.Logger;
	setState(id: string, state: ioBroker.SettableState): Promise<unknown>;
	writeFileAsync(adapter: string, file: string, data: Buffer): Promise<void>;
}

/** Time limit for shell commands, so a command that never ends (e.g. logcat) does not hang */
const SHELL_MS = 120000;

/** Connection timeout for a single connect attempt */
const WAIT_MS = 10000;
/** A port search runs at most this often per device */
const SCAN_EVERY_MS = 5 * 60 * 1000;
/** Time for one port found by the search */
const SCAN_WAIT_MS = 5000;

/**
 * One Android device from the configuration.
 */
export class AndroidDevice {
	readonly ip: string;
	readonly name: string;
	readonly fixedPort?: number;
	/** wireless debugging with a port entered by hand: the port changes, it is searched when mDNS does not help */
	readonly searchPort: boolean;
	/** port that worked last (or the one entered for a changing port) */
	private lastPort?: number;
	private lastScan = 0;
	readonly objectId: string;
	/** adb serial of the current connection, e.g. `192.168.1.5:41235` */
	serial?: string;
	connected = false;
	private busy?: Promise<boolean>;
	private lastStatus = '';
	private infoRead = false;
	/** Hide the debugging notification */
	hideNotification = false;
	/** Interval of the info values in ms, 0 = off */
	readonly pollMs: number;
	private pollTimer?: ioBroker.Timeout;
	private lastStorage = 0;
	private batteryCreated = false;
	/** Apps installed on the device (read when connected) */
	apps: string[] = [];
	private notifyTimer?: ioBroker.Timeout;

	/**
	 * @param adapter adapter
	 * @param client adb client
	 * @param discovery mDNS discovery
	 * @param cfg device configuration
	 * @param objectId object id to use instead of the default (devices of version 0.0.x)
	 */
	constructor(
		private readonly adapter: DeviceHost,
		private readonly client: Client,
		private readonly discovery: Discovery,
		cfg: DeviceConfig,
		objectId?: string,
	) {
		this.ip = cfg.ip;
		this.name = cfg.name || cfg.ip;
		// a port that changes is no fixed port: the device is a wireless debugging device, the port a first guess
		this.searchPort = cfg.portChanges === true;
		this.fixedPort = this.searchPort ? undefined : parsePort(cfg.port);
		this.lastPort = this.searchPort ? parsePort(cfg.port) : undefined;
		const poll = cfg.pollInterval === undefined || cfg.pollInterval === null ? 60 : Number(cfg.pollInterval);
		this.pollMs = Number.isFinite(poll) && poll > 0 ? Math.min(3600, Math.max(10, poll)) * 1000 : 0;
		this.objectId = objectId ?? deviceIdOf(cfg);
	}

	/** Text for logs */
	get label(): string {
		return `${this.name} (${this.ip}${this.fixedPort ? `:${this.fixedPort}` : ''})`;
	}

	/**
	 * Checks whether an adb serial belongs to this device.
	 *
	 * @param serial adb serial
	 */
	owns(serial: string): boolean {
		if (serial === this.serial) {
			return true;
		}
		if (hostOfSerial(serial) !== this.ip) {
			return false;
		}
		return this.fixedPort ? portOfSerial(serial) === this.fixedPort : true;
	}

	/**
	 * Connects if not connected yet. Calls at the same time share one attempt.
	 *
	 * @param quiet do not log failures as warning (periodic reconnect)
	 */
	ensureConnected(quiet = false): Promise<boolean> {
		if (this.connected && this.serial) {
			return Promise.resolve(true);
		}
		this.busy ??= this.connect(quiet).finally(() => (this.busy = undefined));
		return this.busy;
	}

	/**
	 * Connects to the device, looking up the port if needed: the fixed port; else the port mDNS announces and the
	 * one that worked last; for a changing port entered by hand (Docker without mDNS) a search of the ports.
	 *
	 * @param quiet log only at debug level
	 */
	private async connect(quiet: boolean): Promise<boolean> {
		if (this.fixedPort) {
			return this.tryPort(this.fixedPort, quiet, true);
		}
		const candidates = [...new Set([this.discovery.connectPort(this.ip), this.lastPort])].filter(
			(p): p is number => !!p,
		);
		let error = '';
		for (const port of candidates) {
			const result = await this.tryPort(port, quiet, false);
			if (result === true) {
				return true;
			}
			error = result;
		}
		if (this.searchPort && Date.now() - this.lastScan >= SCAN_EVERY_MS) {
			this.lastScan = Date.now();
			await this.setStatus('Searching the port of wireless debugging …', true);
			const ports = (await findOpenPorts(this.ip)).filter(p => !candidates.includes(p));
			this.adapter.log.debug(`${this.label}: open ports ${ports.join(', ') || 'none'}`);
			for (const port of ports) {
				// other services can have open ports too: do not wait long on one that is not adb
				const result = await this.tryPort(port, true, false, SCAN_WAIT_MS);
				if (result === true) {
					this.adapter.log.info(`${this.label}: wireless debugging found on port ${port}`);
					return true;
				}
			}
		}
		if (!candidates.length) {
			this.discovery.refresh();
		}
		await this.setStatus(
			error ||
				(this.searchPort
					? 'Wireless debugging not found (switched off or device asleep?) - the port is searched again in a few minutes'
					: 'Wireless debugging not found in the network (switched off or device asleep?)'),
			quiet,
		);
		await this.setConnected(false);
		return false;
	}

	/** Attempt that sets the status itself (fixed port) */
	private async tryPort(port: number, quiet: boolean, report: true, waitMs?: number): Promise<boolean>;
	/** Attempt that returns the reason of a failure (the caller tries further ports) */
	private async tryPort(port: number, quiet: boolean, report: false, waitMs?: number): Promise<true | string>;
	/**
	 * One connection attempt
	 *
	 * @param port port to try
	 * @param quiet log only at debug level
	 * @param report set the status on failure (else the caller does it)
	 * @param waitMs time for connecting and for the answer of the device
	 * @returns true when connected, else the reason
	 */
	private async tryPort(port: number, quiet: boolean, report: boolean, waitMs = WAIT_MS): Promise<boolean | string> {
		const serial = `${this.ip}:${port}`;
		if (this.serial && this.serial !== serial) {
			// the port has changed: forget the old connection
			await this.client.disconnect(this.ip, portOfSerial(this.serial)).catch(() => undefined);
		}
		try {
			await this.withTimeout(this.client.connect(this.ip, port), waitMs, 'connect timeout');
			this.serial = serial;
			await this.withTimeout(this.device().waitForDevice(), waitMs, 'device did not answer');
			await this.adapter.setState(this.stateId('port'), { val: port, ack: true });
			if (!this.fixedPort) {
				this.lastPort = port;
			}
			await this.onConnected();
			return true;
		} catch (e) {
			const msg = errorText(e);
			if (!this.fixedPort) {
				if (/refused|ECONNREFUSED/i.test(msg)) {
					// the announced port is no longer valid: forget it and ask the network for the current one
					this.discovery.forgetConnect(this.ip, port);
					this.discovery.refresh();
				}
				if (port === this.lastPort) {
					this.lastPort = undefined;
				}
				if (this.serial === serial) {
					// a port that is not (or no longer) adb must not stay in the list of the adb server
					await this.client.disconnect(this.ip, port).catch(() => undefined);
					this.serial = undefined;
				}
			}
			const reason = /unauthorized|did not answer/i.test(msg)
				? 'Device does not allow the connection: confirm "Allow debugging" on the device'
				: `Can not connect: ${msg}`;
			if (!report) {
				return reason;
			}
			await this.setStatus(reason, quiet);
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
	async onTracker(serial: string, type: string | undefined): Promise<void> {
		if (type === 'device') {
			this.serial = serial;
			const p = portOfSerial(serial);
			if (p) {
				await this.adapter.setState(this.stateId('port'), { val: p, ack: true });
			}
			await this.onConnected();
		} else if (serial === this.serial || !this.serial) {
			if (type === 'unauthorized') {
				await this.setStatus('Confirm "Allow debugging" on the device', false);
			} else {
				await this.setStatus(type ? `Device is ${type}` : 'Disconnected', true);
			}
			await this.setConnected(false);
		}
	}

	/** Marks the device connected and reads its info once. */
	private async onConnected(): Promise<void> {
		await this.setConnected(true);
		await this.setStatus('Connected', true);
		if (!this.infoRead) {
			await this.readInfo();
		}
		if (this.hideNotification) {
			// Android posts the notification right after the connection
			this.adapter.clearTimeout(this.notifyTimer);
			this.notifyTimer = this.adapter.setTimeout(() => void this.applyNotification(), 3000);
		}
	}

	/**
	 * Switches hiding of the debugging notification on or off.
	 *
	 * @param hide true to hide
	 */
	async setHideNotification(hide: boolean): Promise<void> {
		this.hideNotification = hide;
		if (this.connected) {
			await this.applyNotification();
		}
	}

	/** Snoozes or unsnoozes the debugging notification, depending on the setting. */
	async applyNotification(): Promise<void> {
		if (this.fixedPort || !this.connected) {
			return;
		}
		try {
			const keys = new Set<string>([DEFAULT_NOTIFICATION_KEY]);
			const dump = await this.run(
				"dumpsys notification --noredact | grep 'channel=DEVELOPER_IMPORTANT' | grep -o 'key=[^ ]*'",
			);
			for (const line of dump.split(/\r?\n/)) {
				const key = line.trim().replace(/^key=/, '').replace(/:$/, '');
				if (/^-?\d+\|android\|\d+\|/.test(key)) {
					keys.add(key);
				}
			}
			for (const key of keys) {
				const cmd = this.hideNotification
					? `cmd notification snooze --for ${SNOOZE_MS} '${key}'`
					: `cmd notification unsnooze '${key}'`;
				await this.run(cmd);
			}
			this.adapter.log.debug(
				`${this.label}: debugging notification ${this.hideNotification ? 'snoozed' : 'shown'}`,
			);
		} catch (e) {
			this.adapter.log.warn(`${this.label}: could not change the debugging notification: ${errorText(e)}`);
		}
	}

	/** Reads model and Android version. */
	private async readInfo(): Promise<void> {
		try {
			const p = await this.device().getProperties();
			const model = [p['ro.product.manufacturer'], p['ro.product.model']].filter(Boolean).join(' ');
			await this.adapter.setState(this.stateId('model'), { val: model, ack: true });
			await this.adapter.setState(this.stateId('androidVersion'), {
				val: p['ro.build.version.release'] ?? '',
				ack: true,
			});
			this.infoRead = true;
		} catch (e) {
			this.adapter.log.debug(`${this.label}: could not read device info: ${errorText(e)}`);
		}
		await this.readApps();
	}

	/** Reads the installed apps once per connection, for the app selection in the settings. */
	async readApps(): Promise<void> {
		try {
			this.apps = parsePackages(await this.readShell('pm list packages -3 --user 0')).sort();
		} catch (e) {
			this.adapter.log.debug(`${this.label}: could not read the app list: ${errorText(e)}`);
		}
	}

	/**
	 * Writes the connection state.
	 *
	 * @param on connected or not
	 */
	private async setConnected(on: boolean): Promise<void> {
		if (this.connected !== on) {
			this.connected = on;
			if (on) {
				this.adapter.log.info(`${this.label} connected`);
			}
		}
		if (on && this.pollMs && !this.pollTimer) {
			this.pollTimer = this.adapter.setTimeout(() => void this.poll(), 2000);
		} else if (!on) {
			this.adapter.clearTimeout(this.pollTimer);
			this.pollTimer = undefined;
		}
		await this.adapter.setState(this.stateId('connection'), { val: on, ack: true });
	}

	/**
	 * Writes the status text and logs changes once.
	 *
	 * @param text text to write
	 * @param quiet log only at debug level
	 */
	private async setStatus(text: string, quiet: boolean): Promise<void> {
		if (text !== this.lastStatus) {
			this.lastStatus = text;
			if (!quiet) {
				this.adapter.log.warn(`${this.label}: ${text}`);
			} else {
				this.adapter.log.debug(`${this.label}: ${text}`);
			}
		}
		await this.adapter.setState(this.stateId('status'), { val: text, ack: true });
	}

	/** adb client for the current connection. */
	private device(): DeviceClient {
		if (!this.serial) {
			throw new Error('not connected');
		}
		return this.client.getDevice(this.serial);
	}

	/**
	 * Runs a command and writes the answer to "result".
	 *
	 * @param state name of the state that was written
	 * @param value value that was written
	 */
	async command(state: string, value: ioBroker.StateValue): Promise<void> {
		const text = String(value ?? '').trim();
		if (!(await this.ensureConnected())) {
			await this.setResult(`error: ${this.lastStatus || 'not connected'}`);
			return;
		}
		try {
			switch (state) {
				case 'shell':
					await this.shell(cleanShellCommand(text));
					break;
				case 'keyevent':
					if (text) {
						const key = /^\d+$/.test(text)
							? text
							: `KEYCODE_${text.toUpperCase().replace(/^KEYCODE_/, '')}`;
						await this.shell(`input keyevent ${key}`);
					}
					break;
				case 'startApp':
					if (text) {
						await this.shell(`am start -n ${startComponent(text)}`);
					}
					break;
				case 'stopApp':
					if (text) {
						await this.shell(`am force-stop ${stopPackage(text)}`);
					}
					break;
				case 'reboot':
					await this.device().reboot();
					await this.setResult('reboot started');
					this.infoRead = false;
					break;
				case 'screencap':
					await this.screencap();
					break;
			}
		} catch (e) {
			const msg = errorText(e);
			this.adapter.log.error(`${this.label}: ${state} failed: ${msg}`);
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
	private async shell(command: string): Promise<void> {
		if (!command) {
			return;
		}
		const out = await this.readShell(command);
		await this.setResult(out || 'ok');
	}

	/**
	 * Runs a shell command and returns its output, without writing "result".
	 *
	 * @param command shell command
	 */
	async run(command: string): Promise<string> {
		if (!(await this.ensureConnected())) {
			throw new Error(this.lastStatus || 'not connected');
		}
		return this.readShell(command);
	}

	/**
	 * Runs a shell command with a time limit and returns its trimmed output.
	 *
	 * @param command shell command
	 */
	private async readShell(command: string): Promise<string> {
		const stream = await this.device().shell(command);
		try {
			const out = await this.withTimeout(
				Adb.util.readAll(stream),
				SHELL_MS,
				'command did not finish within 2 minutes',
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
	private withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
		return new Promise((resolve, reject) => {
			const t = this.adapter.setTimeout(() => reject(new Error(msg)), ms);
			p.then(
				v => {
					this.adapter.clearTimeout(t);
					resolve(v);
				},
				(e: unknown) => {
					this.adapter.clearTimeout(t);
					reject(e instanceof Error ? e : new Error(String(e)));
				},
			);
		});
	}

	/** Reads the info values and schedules the next run while connected. */
	private async poll(): Promise<void> {
		if (!this.connected) {
			this.pollTimer = undefined;
			return;
		}
		try {
			const withStorage = Date.now() - this.lastStorage > 3600_000;
			const info = parseInfo(await this.readShell(infoCommand(withStorage)));
			if (withStorage) {
				this.lastStorage = Date.now();
			}
			await this.writeInfo(info);
		} catch (e) {
			this.adapter.log.debug(`${this.label}: reading info failed: ${errorText(e)}`);
		}
		this.pollTimer = this.connected ? this.adapter.setTimeout(() => void this.poll(), this.pollMs) : undefined;
	}

	/**
	 * Writes the info values to the states.
	 *
	 * @param info parsed values
	 */
	private async writeInfo(info: DeviceInfo): Promise<void> {
		const set = async (name: string, val: ioBroker.StateValue | undefined): Promise<void> => {
			if (val !== undefined) {
				await this.adapter.setState(this.infoId(name), { val, ack: true });
			}
		};
		if (info.battery?.present) {
			if (!this.batteryCreated) {
				for (const [name, common] of Object.entries(BATTERY_STATES)) {
					await this.adapter.extendObject(this.infoId(name), { type: 'state', common, native: {} });
				}
				this.batteryCreated = true;
			}
			await set('batteryLevel', info.battery.level);
			await set('charging', info.battery.charging);
			await set('chargeSource', info.battery.source);
			await set('batteryTemperature', info.battery.temperature);
		}
		await set('screenOn', info.screenOn);
		await set('currentApp', info.currentApp);
		await set('wifiSsid', info.wifiSsid);
		await set('wifiRssi', info.wifiRssi);
		await set('doNotDisturb', info.doNotDisturb);
		await set('storageFree', info.storageFreeGB);
	}

	/**
	 * Switches "do not disturb" on the device.
	 *
	 * @param on true = on
	 */
	async setDoNotDisturb(on: boolean): Promise<void> {
		const out = await this.run(`cmd notification set_dnd ${on ? 'on' : 'off'}`);
		if (/error|exception|unknown/i.test(out)) {
			throw new Error(out);
		}
		this.adapter.log.info(`${this.label}: do not disturb ${on ? 'on' : 'off'}`);
		// Android applies the change with a short delay, so confirm the requested value
		// and let the next reading of the info values correct it if needed
		await this.adapter.setState(this.infoId('doNotDisturb'), { val: on, ack: true });
	}

	/**
	 * Full id of an info state.
	 *
	 * @param name state name
	 */
	infoId(name: string): string {
		return `${this.objectId}.info.${name}`;
	}

	/** Takes a screenshot and stores it as file. */
	private async screencap(): Promise<void> {
		const png = extractPng(await Adb.util.readAll(await this.device().screencap()));
		const file = `${this.objectId}.png`;
		await this.adapter.writeFileAsync(this.adapter.namespace, file, png);
		// same file name as in version 0.0.x for existing visualisations
		await this.adapter.writeFileAsync(this.adapter.namespace, 'screenshot.png', png);
		await this.setResult(`screenshot saved: /${this.adapter.namespace}/${file}`);
	}

	/**
	 * Writes the result state.
	 *
	 * @param text text to write
	 */
	private async setResult(text: string): Promise<void> {
		await this.adapter.setState(this.stateId('result'), { val: text, ack: true });
	}

	/**
	 * Full id of a state of this device.
	 *
	 * @param state state name
	 */
	stateId(state: string): string {
		return `${this.objectId}.${state}`;
	}

	/** Closes the connection */
	async close(): Promise<void> {
		this.adapter.clearTimeout(this.notifyTimer);
		this.adapter.clearTimeout(this.pollTimer);
		this.pollTimer = undefined;
		if (this.serial) {
			await this.client.disconnect(this.ip, portOfSerial(this.serial)).catch(() => undefined);
		}
	}
}

/**
 * Message of an unknown error.
 *
 * @param e error
 */
export function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
