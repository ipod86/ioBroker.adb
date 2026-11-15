/*
 * ioBroker adapter for Android Debug Bridge
 */
import * as utils from '@iobroker/adapter-core';
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { Adb, type Client } from '@devicefarmer/adbkit';
import { hostRequest } from './lib/adbHost';
import { AndroidDevice, DEVICE_STATES, INFO_STATES, WIRELESS_STATES, errorText } from './lib/device';
import { Discovery } from './lib/discovery';
import {
	checkDevices,
	isValidPairingCode,
	normalizePairingCode,
	pairingQrText,
	pairSucceeded,
	parsePort,
	parsePackages,
	legacyObjectId,
	parseAdbVersion,
	ADB_MIN_PAIRING,
	isPackageName,
	AUTOMATION_APPS,
	type DeviceConfig,
} from './lib/util';

type Tracker = Awaited<ReturnType<Client['trackDevices']>>;

interface TrackedDevice {
	id: string;
	type?: string;
}

/** Answer texts (keys of admin/i18n) */
const AUTOMATION_GRANTED =
	'%s may now switch wireless debugging on. In the app create a macro: when the phone has started or is connected to your home Wi-Fi → system setting (global) adb_wifi_enabled = 1.';
const ADB_MISSING =
	'The adb program is not installed. On Debian/Ubuntu install it with: sudo apt install adb – then restart the adapter.';
const ADB_TOO_OLD =
	'adb version %s is too old for wireless debugging (pairing needs version 30 or newer). Debian 12 / Raspberry Pi OS bookworm: install the newer version from bookworm-backports, see the adapter documentation.';
const NO_AUTOMATION_APP =
	'No supported automation app found on the device. Install one of: %s – then press the button again.';

/** The adapter. */
class AdbAdapter extends utils.Adapter {
	private client?: Client;
	private tracker?: Tracker;
	private discovery?: Discovery;
	private devices: AndroidDevice[] = [];
	private timer?: ioBroker.Timeout;
	private interval = 30000;
	private unloading = false;
	private snoozeTimer?: ioBroker.Interval;
	private serverHost = '127.0.0.1';
	private serverPort = 5037;
	private serverOk?: boolean;
	private texts: Record<string, string> = {};
	private adbBin = 'adb';
	/** result of the check of the adb program */
	private adbCheck = '';
	private qr?: {
		name: string;
		password: string;
		created: number;
		/** result of the pairing started in the background */
		done?: { ip?: string; error?: string };
		/** "wait for the device" requests from the settings page */
		listeners: ((r: { ip?: string; error?: string }) => void)[];
	};

	/**
	 * @param options adapter options
	 */
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: 'adb' });
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/** Starts the adapter. */
	private async onReady(): Promise<void> {
		await this.setState('info.connection', false, true);
		await this.loadTexts();

		const host = String(this.config.adbHostOption || '127.0.0.1').trim();
		// "localhost" can resolve to ::1, but the adb server only listens on IPv4
		this.serverHost = host === 'localhost' ? '127.0.0.1' : host;
		this.serverPort = parsePort(this.config.adbPortOption) ?? 5037;
		const bin = String(this.config.adbPath || '').trim() || 'adb';
		this.adbBin = bin;
		await this.checkAdbProgram();

		this.client = Adb.createClient({ host: this.serverHost, port: this.serverPort, bin });
		this.discovery = new Discovery(this.log, this);
		this.discovery.start();

		const { ok, problems } = checkDevices(this.config.devices);
		problems.forEach(p => this.log.warn(p));
		for (const cfg of ok) {
			const dev = new AndroidDevice(this, this.client, this.discovery, cfg, await this.legacyId(cfg));
			await this.createDeviceObjects(dev);
			await this.setState(dev.stateId('connection'), false, true);
			if (!dev.fixedPort) {
				// the setting decides at start; the state can switch it until the next restart
				dev.hideNotification = cfg.hideNotification === true;
				await this.setState(dev.stateId('hideNotification'), dev.hideNotification, true);
			}
			this.devices.push(dev);
		}
		if (!this.devices.length) {
			this.log.info('No devices configured yet. Add them in the adapter settings.');
		}

		// only the writable states of the devices are needed
		for (const dev of this.devices) {
			for (const [name, common] of Object.entries({ ...DEVICE_STATES, ...WIRELESS_STATES })) {
				if (common.write && (name in DEVICE_STATES || !dev.fixedPort)) {
					await this.subscribeStatesAsync(dev.stateId(name));
				}
			}
			if (dev.pollMs) {
				await this.subscribeStatesAsync(dev.infoId('doNotDisturb'));
			}
		}
		this.interval = Math.min(3600, Math.max(10, Number(this.config.reconnectInterval) || 30)) * 1000;
		// give mDNS a moment to collect the announcements before the first connect
		this.timer = this.setTimeout(() => void this.loop(), 3000);
		// renew the snooze of the debugging notification now and then
		this.snoozeTimer = this.setInterval(
			() => {
				for (const dev of this.devices) {
					if (dev.hideNotification) {
						void dev.applyNotification();
					}
				}
			},
			6 * 3600 * 1000,
		);
	}

	/**
	 * Devices created by version 0.0.x keep their object id (with colon), so scripts and visualisations keep working.
	 *
	 * @param cfg device configuration
	 */
	private async legacyId(cfg: DeviceConfig): Promise<string | undefined> {
		const port = parsePort(cfg.port);
		if (!port) {
			return undefined;
		}
		const id = legacyObjectId(cfg.ip, port);
		const obj = await this.getObjectAsync(id);
		if (obj?.type === 'device') {
			this.log.debug(`${cfg.ip}:${port} keeps the object id ${id} of version 0.0.x`);
			return id;
		}
		return undefined;
	}

	/** Runs tick() again and again; the next run starts only after the previous one has finished. */
	private async loop(): Promise<void> {
		try {
			await this.tick();
		} catch (e) {
			this.log.warn(`Check of the connections failed: ${errorText(e)}`);
		}
		if (!this.unloading) {
			this.timer = this.setTimeout(() => void this.loop(), this.interval);
		}
	}

	/** Checks the adb server and reconnects devices */
	private async tick(): Promise<void> {
		if (!this.tracker && !(await this.startTracking())) {
			return;
		}
		for (const dev of this.devices) {
			if (!dev.connected) {
				await dev.ensureConnected(true);
			}
		}
	}

	/** True if the adb server runs on this computer */
	private get localServer(): boolean {
		return ['127.0.0.1', '::1', 'localhost'].includes(this.serverHost);
	}

	/**
	 * Checks whether the adb program is installed and new enough for pairing.
	 * Problems are shown as notification in the admin.
	 *
	 * @param notify register an admin notification on problems
	 */
	private async checkAdbProgram(notify = true): Promise<void> {
		if (!this.localServer) {
			this.adbCheck = this.t(
				'The adb server runs on %s – the adb program there is not checked.',
				this.serverHost,
			);
			return;
		}
		const output = await new Promise<{ out: string; err?: Error & { code?: unknown } }>(resolve => {
			execFile(this.adbBin, ['version'], { timeout: 10000 }, (err, stdout) =>
				resolve({ out: String(stdout ?? ''), err: err ?? undefined }),
			);
		});
		let problem = '';
		let problemEn = '';
		if (output.err && (output.err.code === 'ENOENT' || !output.out)) {
			problemEn = ADB_MISSING;
			problem = this.t(ADB_MISSING);
			this.adbCheck = `❌ ${problem}`;
		} else {
			const v = parseAdbVersion(output.out);
			if (!v) {
				this.adbCheck = this.t('adb found, version unknown');
			} else if (v.major < ADB_MIN_PAIRING) {
				problemEn = ADB_TOO_OLD.replace('%s', v.text);
				problem = this.t(ADB_TOO_OLD, v.text);
				this.adbCheck = `⚠️ ${problem}`;
			} else {
				this.adbCheck = `✅ ${this.t('adb version %s – pairing supported', v.text)}`;
			}
		}
		if (problem) {
			this.log.warn(problemEn);
			if (notify) {
				try {
					await this.registerNotification('adb', 'adbProgram', problem);
				} catch (e) {
					this.log.debug(`notification: ${errorText(e)}`);
				}
			}
		}
	}

	/** Connects to the adb server and follows its device list. */
	private async startTracking(): Promise<boolean> {
		try {
			// starts the adb server if it runs on this host and is not running yet
			await this.client!.version();
			const tracker = await this.client!.trackDevices();
			this.tracker = tracker;
			tracker.on('add', (d: TrackedDevice) => void this.onTracker(d.id, d.type));
			tracker.on('change', (d: TrackedDevice) => void this.onTracker(d.id, d.type));
			tracker.on('remove', (d: TrackedDevice) => void this.onTracker(d.id, undefined));
			tracker.on('end', () => {
				this.tracker = undefined;
				if (this.unloading) {
					return;
				}
				this.serverOk = false;
				void this.setState('info.connection', false, true);
				this.log.warn('Connection to adb server lost, retrying');
				for (const dev of this.devices) {
					void dev.onTracker(dev.serial ?? '', undefined);
				}
			});
			tracker.on('error', (e: unknown) => this.log.debug(`tracker: ${errorText(e)}`));
			if (this.serverOk !== true) {
				this.log.info(`Connected to adb server ${this.serverHost}:${this.serverPort}`);
			}
			this.serverOk = true;
			await this.setState('info.connection', true, true);
			return true;
		} catch (e) {
			const msg = errorText(e);
			if (this.serverOk !== false) {
				this.log.error(
					/ENOENT/.test(msg)
						? 'adb program not found. Install it (Debian/Ubuntu: "sudo apt install adb") or enter its path in the settings.'
						: `adb server ${this.serverHost}:${this.serverPort} not reachable: ${msg}`,
				);
			}
			this.serverOk = false;
			await this.setState('info.connection', false, true);
			return false;
		}
	}

	/**
	 * Forwards a change of the adb device list to the device.
	 *
	 * @param serial adb serial
	 * @param type device type or service type
	 */
	private async onTracker(serial: string, type: string | undefined): Promise<void> {
		this.log.debug(`adb: ${serial} ${type ?? 'removed'}`);
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
	private async createDeviceObjects(dev: AndroidDevice): Promise<void> {
		const common: ioBroker.DeviceCommon = {
			name: dev.name,
			statusStates: { onlineId: `${this.namespace}.${dev.stateId('connection')}` },
		};
		const existing = await this.getObjectAsync(dev.objectId);
		if (existing) {
			// version 0.0.x wrote state attributes (type, role, read, write) into the device object
			const old = existing.common as Record<string, unknown>;
			for (const key of ['type', 'role', 'read', 'write']) {
				delete old[key];
			}
			await this.setObject(dev.objectId, {
				...existing,
				type: 'device',
				common: { ...(old as unknown as ioBroker.DeviceCommon), ...common },
				native: { ...existing.native, ip: dev.ip, port: dev.fixedPort ?? null },
			});
		} else {
			await this.setObject(dev.objectId, {
				type: 'device',
				common,
				native: { ip: dev.ip, port: dev.fixedPort ?? null },
			});
		}
		for (const [id, common] of Object.entries(DEVICE_STATES)) {
			await this.extendObject(dev.stateId(id), { type: 'state', common, native: {} });
		}
		if (dev.pollMs) {
			await this.extendObject(`${dev.objectId}.info`, {
				type: 'channel',
				common: {
					name: {
						en: 'Device info',
						de: 'Geräte-Infos',
						ru: 'Информация об устройстве',
						pt: 'Informações do dispositivo',
						nl: 'Apparaatinfo',
						fr: "Infos sur l'appareil",
						it: 'Info dispositivo',
						es: 'Información del dispositivo',
						pl: 'Informacje o urządzeniu',
						uk: 'Інформація про пристрій',
						'zh-cn': '设备信息',
					},
				},
				native: {},
			});
			for (const [name, common] of Object.entries(INFO_STATES)) {
				await this.extendObject(dev.infoId(name), { type: 'state', common, native: {} });
			}
		}
		if (!dev.fixedPort) {
			for (const [id, common] of Object.entries(WIRELESS_STATES)) {
				await this.extendObject(dev.stateId(id), { type: 'state', common, native: {} });
			}
		}
	}

	/**
	 * Runs commands written to device states.
	 *
	 * @param id state id
	 * @param state new state
	 */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}
		const parts = id.split('.');
		const name = parts.pop()!;
		if (name === 'doNotDisturb' && parts[parts.length - 1] === 'info') {
			parts.pop();
			const d = this.devices.find(x => x.objectId === parts[parts.length - 1]);
			if (d) {
				try {
					await d.setDoNotDisturb(state.val === true || state.val === 'true' || state.val === 1);
				} catch (e) {
					this.log.warn(`${d.label}: do not disturb: ${errorText(e)}`);
				}
			}
			return;
		}
		const objectId = parts.pop();
		const dev = this.devices.find(d => d.objectId === objectId);
		if (dev && !dev.fixedPort && name === 'hideNotification') {
			await dev.setHideNotification(state.val === true || state.val === 'true' || state.val === 1);
			await this.setState(id, dev.hideNotification, true);
			return;
		}
		if (!dev || !DEVICE_STATES[name]?.write) {
			return;
		}
		await dev.command(name, state.val);
		// confirm the command (buttons too, see the state roles)
		await this.setState(id, state.val, true);
	}

	/**
	 * Answers requests from the settings page.
	 *
	 * @param obj message
	 */
	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj || typeof obj.message !== 'object' || !obj.callback) {
			return;
		}
		const msg = obj.message as Record<string, unknown>;
		let answer: Record<string, unknown>;
		try {
			switch (obj.command) {
				case 'pair':
					answer = await this.pairWithCode(msg);
					break;
				case 'qrCode':
					// qrCodeSendTo expects a plain string
					this.sendTo(obj.from, obj.command, this.qrCode().text, obj.callback);
					return;
				case 'qrPair':
					answer = await this.pairWithQr();
					break;
				case 'discover':
					answer = await this.discover(msg);
					break;
				case 'adbVersion':
					// textSendTo expects a plain string
					await this.checkAdbProgram(false);
					this.sendTo(obj.from, obj.command, this.adbCheck, obj.callback);
					return;
				case 'listApps':
					// selectSendTo expects a plain array
					this.sendTo(obj.from, obj.command, await this.listApps(msg), obj.callback);
					return;
				case 'grantAutomation':
					answer = await this.grantAutomation(msg);
					break;
				default:
					answer = { error: `Unknown command ${obj.command}` };
			}
		} catch (e) {
			answer = { error: errorText(e) };
		}
		this.sendTo(obj.from, obj.command, answer, obj.callback);
	}

	/**
	 * Pairs with the 6-digit code ("Pair device with pairing code").
	 *
	 * @param msg ip, port (optional), code, devices from the form
	 */
	private async pairWithCode(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
		const ip = typeof msg.ip === 'string' ? msg.ip.trim() : '';
		const code = normalizePairingCode(msg.code as string);
		if (!ip) {
			return { error: 'Enter the IP address of the device' };
		}
		if (!isValidPairingCode(code)) {
			return { error: 'The pairing code has 6 digits' };
		}
		let port = parsePort(msg.port as string);
		if (!port) {
			const found = await this.discovery!.waitForPairing(s => s.ip === ip, 8000);
			port = found?.port;
		}
		if (!port) {
			return {
				error: 'Pairing port not found. Keep the pairing dialog open on the device, or enter the port shown there.',
			};
		}
		await this.pair(ip, port, code);
		return this.pairedAnswer(ip, msg.devices);
	}

	/**
	 * Creates the QR code text for "Pair device with QR code" and starts waiting for the device in the background,
	 * so the device is paired as soon as it has scanned the code.
	 */
	private qrCode(): { text: string } {
		if (!this.qr || this.qr.done || Date.now() - this.qr.created > 10 * 60_000) {
			const qr: NonNullable<AdbAdapter['qr']> = {
				name: `iobroker-${randomBytes(3).toString('hex')}`,
				password: String(randomInt(100000, 1000000)),
				created: Date.now(),
				listeners: [],
			};
			this.qr = qr;
			void this.qrBackground(qr);
		}
		return { text: pairingQrText(this.qr.name, this.qr.password) };
	}

	/**
	 * Waits up to 10 minutes for the device that scans the QR code and pairs it.
	 *
	 * @param qr QR code data
	 */
	private async qrBackground(qr: NonNullable<AdbAdapter['qr']>): Promise<void> {
		const found = await this.discovery!.waitForPairing(s => s.name === qr.name, 10 * 60_000);
		if (this.qr !== qr) {
			return;
		}
		if (!found) {
			qr.done = { error: this.t('No device has scanned the QR code') };
		} else {
			this.log.info(`${found.ip} has scanned the QR code, pairing`);
			try {
				await this.pair(found.ip, found.port, qr.password);
				qr.done = { ip: found.ip };
			} catch (e) {
				qr.done = { error: errorText(e) };
				this.log.warn(`Pairing with QR code failed: ${qr.done.error}`);
			}
		}
		qr.listeners.forEach(l => l(qr.done!));
		qr.listeners = [];
		if (qr.done.ip) {
			// the settings page may have lost its connection while the user was scanning,
			// so the device is always added to the saved configuration here
			await this.addDeviceToConfig(qr.done.ip);
		}
	}

	/**
	 * Adds a paired device to the saved configuration (restarts the adapter).
	 *
	 * @param ip device IP address
	 */
	private async addDeviceToConfig(ip: string): Promise<void> {
		const devices = this.config.devices ?? [];
		if (devices.some(d => String(d.ip).trim() === ip)) {
			return;
		}
		const entry = this.pairedAnswer(ip, devices).native as { devices: DeviceConfig[] };
		this.log.info(`Adding paired device ${ip} to the device list`);
		await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, { native: { devices: entry.devices } });
	}

	/**
	 * Answer for "wait for the device": result of the QR pairing, waits up to 60 seconds.
	 */
	private async pairWithQr(): Promise<Record<string, unknown>> {
		const qr = this.qr;
		if (!qr) {
			return { error: 'Show the QR code first' };
		}
		const result =
			qr.done ??
			(await new Promise<{ ip?: string; error?: string }>(resolve => {
				let timer: ioBroker.Timeout | undefined = undefined;
				const listener = (r: { ip?: string; error?: string }): void => {
					this.clearTimeout(timer);
					resolve(r);
				};
				timer = this.setTimeout(() => {
					qr.listeners = qr.listeners.filter(l => l !== listener);
					resolve({ error: 'No device has scanned the QR code within 60 seconds' });
				}, 60_000);
				qr.listeners.push(listener);
			}));
		if (!result.ip) {
			return { error: result.error };
		}
		// the device was added to the saved configuration: reload the page to show it
		return { result: 'pairedAdded', args: [result.ip], reloadBrowser: true };
	}

	/**
	 * Sends the pairing request to the adb server.
	 *
	 * @param ip device IP address
	 * @param port pairing port
	 * @param code pairing code or password
	 */
	private async pair(ip: string, port: number, code: string): Promise<void> {
		// make sure the adb server runs
		await this.client!.version();
		const answer = await hostRequest(this.serverHost, this.serverPort, `host:pair:${code}:${ip}:${port}`, 30_000);
		this.log.info(`Pairing ${ip}:${port}: ${answer}`);
		if (!pairSucceeded(answer)) {
			throw new Error(answer || 'Pairing failed');
		}
	}

	/**
	 * Answer after pairing: adds the device to the list in the form, if missing.
	 *
	 * @param ip device IP
	 * @param formDevices device list currently shown in the form
	 */
	private pairedAnswer(ip: string, formDevices: unknown): Record<string, unknown> {
		const devices: DeviceConfig[] = Array.isArray(formDevices)
			? (formDevices as DeviceConfig[])
			: [...(this.config.devices ?? [])];
		const known = devices.some(d => String(d.ip).trim() === ip);
		if (known) {
			return { result: 'paired', args: [ip] };
		}
		const found = this.discovery!.devices().find(s => s.ip === ip);
		const name = found?.name.replace(/^adb-/, '').replace(/-[^-]+$/, '') || ip;
		return {
			result: 'pairedAdded',
			args: [ip],
			native: { devices: [...devices, { enabled: true, name, ip, port: '' }] },
		};
	}

	/** Loads the texts of the settings page in the system language, for answers shown there. */
	private async loadTexts(): Promise<void> {
		try {
			const sys = await this.getForeignObjectAsync('system.config');
			const lang = (sys?.common?.language as string) || 'en';
			const dir = join(__dirname, '..', 'admin', 'i18n');
			this.texts = JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as Record<string, string>;
		} catch {
			this.texts = {};
		}
	}

	/**
	 * Text in the system language, `%s` replaced by the arguments.
	 *
	 * @param key English text
	 * @param args replacements for %s
	 */
	private t(key: string, ...args: string[]): string {
		let text = this.texts[key] || key;
		for (const a of args) {
			text = text.replace('%s', a);
		}
		return text;
	}

	/**
	 * Apps of a device for the selection in the device list: automatic search first,
	 * then the known automation apps found on the device, then all other apps.
	 *
	 * @param msg ip of the device
	 */
	private async listApps(
		msg: Record<string, unknown>,
	): Promise<{ value: string; label: string; noTranslation?: boolean }[]> {
		const ip = typeof msg.ip === 'string' ? msg.ip.trim() : '';
		const dev = this.devices.find(d => d.ip === ip);
		const list: { value: string; label: string; noTranslation?: boolean }[] = [
			{ value: 'auto', label: 'Automatic' },
		];
		if (!dev) {
			return list;
		}
		if (!dev.apps.length && dev.connected) {
			await dev.readApps();
		}
		const known = dev.apps.filter(p => AUTOMATION_APPS[p]);
		const rest = dev.apps.filter(p => !AUTOMATION_APPS[p]);
		for (const p of known) {
			list.push({ value: p, label: `${AUTOMATION_APPS[p]} (${p})`, noTranslation: true });
		}
		for (const p of rest) {
			list.push({ value: p, label: p, noTranslation: true });
		}
		return list;
	}

	/**
	 * Allows installed automation apps to write secure settings, so they can switch
	 * wireless debugging on again after a reboot (`settings put global adb_wifi_enabled 1`).
	 *
	 * @param msg ip of the device
	 */
	private async grantAutomation(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
		const ip = typeof msg.ip === 'string' ? msg.ip.trim() : '';
		const dev = this.devices.find(d => d.ip === ip);
		if (!dev) {
			return { error: 'Save the settings first, then try again' };
		}
		const app = typeof msg.app === 'string' ? msg.app.trim() : '';
		const chosen = app === 'auto' ? '' : app;
		let apps: string[];
		if (chosen) {
			if (!isPackageName(chosen)) {
				return { error: 'This is not a valid package name' };
			}
			apps = [chosen];
		} else {
			const installed = parsePackages(await dev.run('pm list packages --user 0'));
			apps = Object.keys(AUTOMATION_APPS).filter(p => installed.includes(p));
			if (!apps.length) {
				return { result: this.t(NO_AUTOMATION_APP, Object.values(AUTOMATION_APPS).join(', ')) };
			}
		}
		const done: string[] = [];
		for (const pkg of apps) {
			const out = await dev.run(`pm grant ${pkg} android.permission.WRITE_SECURE_SETTINGS`);
			if (out) {
				this.log.warn(`${dev.label}: granting ${pkg} failed: ${out}`);
			} else {
				done.push(AUTOMATION_APPS[pkg] ?? pkg);
			}
		}
		if (!done.length) {
			return { error: 'The device refused the permission, see the log' };
		}
		this.log.info(`${dev.label}: ${done.join(', ')} may now switch wireless debugging on`);
		return { result: this.t(AUTOMATION_GRANTED, done.join(', ')) };
	}

	/**
	 * Lists devices with wireless debugging in the network.
	 *
	 * @param _msg unused
	 */
	private async discover(_msg: Record<string, unknown>): Promise<Record<string, unknown>> {
		this.discovery!.refresh();
		await this.delay(3000);
		const list = this.discovery!.devices();
		if (!list.length) {
			return { result: 'noneFound' };
		}
		return {
			result: 'found',
			args: [list.map(s => `${s.ip} (port ${s.port}, ${s.name})`).join('\n')],
		};
	}

	/**
	 * Stops everything.
	 *
	 * @param callback called when done
	 */
	private async onUnload(callback: () => void): Promise<void> {
		try {
			this.unloading = true;
			this.clearTimeout(this.timer);
			if (this.snoozeTimer) {
				this.clearInterval(this.snoozeTimer);
			}
			this.tracker?.end();
			this.discovery?.stop();
			await Promise.all(this.devices.map(d => d.close()));
		} finally {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AdbAdapter(options);
} else {
	// otherwise start the instance directly
	(() => new AdbAdapter())();
}
