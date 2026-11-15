import { Adb, type Client, type DeviceClient } from '@devicefarmer/adbkit';
import type { Discovery } from './discovery';
import {
	cleanShellCommand,
	deviceObjectId,
	extractPng,
	hostOfSerial,
	parsePort,
	portOfSerial,
	startComponent,
	stopPackage,
	type DeviceConfig,
} from './util';

/** States of each device. The ids of version 0.0.x are kept, so existing scripts keep working. */
export const DEVICE_STATES: Record<string, ioBroker.StateCommon> = {
	connection: {
		name: { en: 'Connected', de: 'Verbunden' },
		type: 'boolean',
		role: 'indicator.connected',
		read: true,
		write: false,
		def: false,
	},
	status: {
		name: { en: 'Connection status', de: 'Verbindungsstatus' },
		type: 'string',
		role: 'text',
		read: true,
		write: false,
		def: '',
	},
	port: {
		name: { en: 'Current port', de: 'Aktueller Port' },
		type: 'number',
		role: 'value',
		read: true,
		write: false,
	},
	model: {
		name: { en: 'Model', de: 'Modell' },
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	androidVersion: {
		name: { en: 'Android version', de: 'Android-Version' },
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	shell: {
		name: { en: 'Shell command', de: 'Shell-Befehl' },
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'e.g. "input keyevent 26"; the answer is written to "result"',
	},
	keyevent: {
		name: { en: 'Send key', de: 'Taste senden' },
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Key code or name, e.g. 26, POWER, HOME, BACK, VOLUME_UP',
	},
	result: {
		name: { en: 'Command result', de: 'Ergebnis des Befehls' },
		type: 'string',
		role: 'text',
		read: true,
		write: false,
	},
	startApp: {
		name: { en: 'Start an app', de: 'App starten' },
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Component like com.example.app/.MainActivity',
	},
	stopApp: {
		name: { en: 'Stop an app', de: 'App beenden' },
		type: 'string',
		role: 'text',
		read: true,
		write: true,
		desc: 'Package name like com.example.app',
	},
	reboot: {
		name: { en: 'Reboot device', de: 'Gerät neu starten' },
		type: 'boolean',
		role: 'button',
		read: false,
		write: true,
	},
	screencap: {
		name: { en: 'Take screenshot', de: 'Bildschirmfoto aufnehmen' },
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
		name: { en: 'Hide the debugging notification', de: 'Debugging-Benachrichtigung ausblenden' },
		type: 'boolean',
		role: 'switch',
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

/** What the device needs from the adapter */
export interface DeviceHost {
	namespace: string;
	log: ioBroker.Logger;
	setState(id: string, state: ioBroker.SettableState): Promise<unknown>;
	writeFileAsync(adapter: string, file: string, data: Buffer): Promise<void>;
}

/** Connection timeout for a single connect attempt */
const WAIT_MS = 10000;

/**
 * One Android device from the configuration.
 */
export class AndroidDevice {
	readonly ip: string;
	readonly name: string;
	readonly fixedPort?: number;
	readonly objectId: string;
	/** adb serial of the current connection, e.g. `192.168.1.5:41235` */
	serial?: string;
	connected = false;
	private busy?: Promise<boolean>;
	private lastStatus = '';
	private infoRead = false;
	/** Hide the debugging notification */
	hideNotification = false;

	/**
	 * @param host adapter
	 * @param client adb client
	 * @param discovery mDNS discovery
	 * @param cfg device configuration
	 */
	constructor(
		private readonly host: DeviceHost,
		private readonly client: Client,
		private readonly discovery: Discovery,
		cfg: DeviceConfig,
	) {
		this.ip = cfg.ip;
		this.name = cfg.name || cfg.ip;
		this.fixedPort = parsePort(cfg.port);
		this.objectId = deviceObjectId(this.ip, this.fixedPort);
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
	 * Connects to the device, looking up the port if needed.
	 *
	 * @param quiet log only at debug level
	 */
	private async connect(quiet: boolean): Promise<boolean> {
		let port = this.fixedPort;
		if (!port) {
			port = this.discovery.connectPort(this.ip);
			if (!port) {
				this.discovery.refresh();
				await this.setStatus(
					'Wireless debugging not found in the network (switched off or device asleep?)',
					quiet,
				);
				return false;
			}
		}
		const serial = `${this.ip}:${port}`;
		if (this.serial && this.serial !== serial) {
			// the port has changed: forget the old connection
			await this.client.disconnect(this.ip, portOfSerial(this.serial)).catch(() => undefined);
		}
		try {
			await withTimeout(this.client.connect(this.ip, port), WAIT_MS, 'connect timeout');
			this.serial = serial;
			await this.host.setState(this.stateId('port'), { val: port, ack: true });
			await withTimeout(this.device().waitForDevice(), WAIT_MS, 'device did not answer');
			await this.onConnected();
			return true;
		} catch (e) {
			const msg = errorText(e);
			await this.setStatus(
				/unauthorized|did not answer/i.test(msg)
					? 'Device does not allow the connection: confirm "Allow debugging" on the device'
					: `Can not connect: ${msg}`,
				quiet,
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
	async onTracker(serial: string, type: string | undefined): Promise<void> {
		if (type === 'device') {
			this.serial = serial;
			const p = portOfSerial(serial);
			if (p) {
				await this.host.setState(this.stateId('port'), { val: p, ack: true });
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
			setTimeout(() => void this.applyNotification(), 3000);
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
			this.host.log.debug(`${this.label}: debugging notification ${this.hideNotification ? 'snoozed' : 'shown'}`);
		} catch (e) {
			this.host.log.warn(`${this.label}: could not change the debugging notification: ${errorText(e)}`);
		}
	}

	/** Reads model and Android version. */
	private async readInfo(): Promise<void> {
		try {
			const p = await this.device().getProperties();
			const model = [p['ro.product.manufacturer'], p['ro.product.model']].filter(Boolean).join(' ');
			await this.host.setState(this.stateId('model'), { val: model, ack: true });
			await this.host.setState(this.stateId('androidVersion'), {
				val: p['ro.build.version.release'] ?? '',
				ack: true,
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
	private async setConnected(on: boolean): Promise<void> {
		if (this.connected !== on) {
			this.connected = on;
			if (on) {
				this.host.log.info(`${this.label} connected`);
			}
		}
		await this.host.setState(this.stateId('connection'), { val: on, ack: true });
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
				this.host.log.warn(`${this.label}: ${text}`);
			} else {
				this.host.log.debug(`${this.label}: ${text}`);
			}
		}
		await this.host.setState(this.stateId('status'), { val: text, ack: true });
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
	private async shell(command: string): Promise<void> {
		if (!command) {
			return;
		}
		const out = await Adb.util.readAll(await this.device().shell(command));
		await this.setResult(out.toString().trim() || 'ok');
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
		const out = await Adb.util.readAll(await this.device().shell(command));
		return out.toString().trim();
	}

	/** Takes a screenshot and stores it as file. */
	private async screencap(): Promise<void> {
		const png = extractPng(await Adb.util.readAll(await this.device().screencap()));
		const file = `${this.objectId}.png`;
		await this.host.writeFileAsync(this.host.namespace, file, png);
		// same file name as in version 0.0.x for existing visualisations
		await this.host.writeFileAsync(this.host.namespace, 'screenshot.png', png);
		await this.setResult(`screenshot saved: /${this.host.namespace}/${file}`);
	}

	/**
	 * Writes the result state.
	 *
	 * @param text text to write
	 */
	private async setResult(text: string): Promise<void> {
		await this.host.setState(this.stateId('result'), { val: text, ack: true });
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
		if (this.serial) {
			await this.client.disconnect(this.ip, portOfSerial(this.serial)).catch(() => undefined);
		}
	}
}

/**
 * Rejects if the promise does not settle in time.
 *
 * @param p promise
 * @param ms time limit in ms
 * @param msg error text
 */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(msg)), ms);
		p.then(
			v => {
				clearTimeout(t);
				resolve(v);
			},
			(e: unknown) => {
				clearTimeout(t);
				reject(e instanceof Error ? e : new Error(String(e)));
			},
		);
	});
}

/**
 * Message of an unknown error.
 *
 * @param e error
 */
export function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
