/**
 * Small helpers without side effects, so they can be unit tested.
 */

/** A device from the adapter configuration */
export interface DeviceConfig {
	enabled: boolean;
	name: string;
	ip: string;
	/** Fixed port, or empty for wireless debugging with changing ports */
	port: string | number;
	/** Package name of the automation app that switches wireless debugging on after a reboot */
	automationApp?: string;
	/** Interval of the info values in seconds, 0 = off (default 60) */
	pollInterval?: number;
	/** Hide the "wireless debugging connected" notification */
	hideNotification?: boolean;
}

/**
 * Parses the configured port. Empty, 0 or invalid means "find the port automatically".
 *
 * @param port value from the configuration
 */
export function parsePort(port: string | number | undefined | null): number | undefined {
	const n = typeof port === 'number' ? port : parseInt(String(port ?? '').trim(), 10);
	return Number.isInteger(n) && n > 0 && n < 65536 ? n : undefined;
}

/**
 * Object id of a device below the adapter namespace.
 * Devices with a fixed port keep the id of older versions (`192_168_1_5_5555`),
 * devices with changing ports only use the IP address, so the id survives a port change.
 *
 * @param ip IP address or host name
 * @param port fixed port, if any
 */
export function deviceObjectId(ip: string, port?: number): string {
	// host names are not case-sensitive
	const base = port ? `${ip.trim().toLowerCase()}:${port}` : ip.trim().toLowerCase();
	return base.replace(/[.:]/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
}

/** First port of the range Android gives wireless debugging; `adb tcpip` uses ports below (usually 5555) */
export const WIRELESS_PORT_MIN = 32768;

/**
 * Whether a port entered by hand is the (changing) port of wireless debugging and not a fixed one of `adb tcpip`
 *
 * @param port port
 */
export function isWirelessPort(port: number | undefined): boolean {
	return !!port && port >= WIRELESS_PORT_MIN;
}

/**
 * Host part of an adb serial like `192.168.1.5:5555`.
 * Returns undefined for USB or mDNS serials.
 *
 * @param serial adb serial number
 */
export function hostOfSerial(serial: string): string | undefined {
	const m = /^(.+):(\d+)$/.exec(serial);
	return m ? m[1] : undefined;
}

/**
 * Port part of an adb serial like `192.168.1.5:5555`.
 *
 * @param serial adb serial number
 */
export function portOfSerial(serial: string): number | undefined {
	const m = /:(\d+)$/.exec(serial);
	return m ? parseInt(m[1], 10) : undefined;
}

/**
 * Pairing codes are shown as 6 digits on the phone; people often type them with spaces.
 *
 * @param code code as entered
 */
export function normalizePairingCode(code: string | number | undefined): string {
	return String(code ?? '').replace(/[\s-]/g, '');
}

/**
 * Checks a pairing code: 6 digits as shown on Android.
 *
 * @param code normalized code
 */
export function isValidPairingCode(code: string): boolean {
	return /^\d{6}$/.test(code);
}

/**
 * Interprets the answer of the adb server to `host:pair:…`.
 *
 * @param answer text from the adb server
 */
export function pairSucceeded(answer: string): boolean {
	return /successfully paired/i.test(answer);
}

/**
 * Text for the QR code that Android scans in "Pair device with QR code".
 *
 * @param name service name the phone will announce
 * @param password pairing password
 */
export function pairingQrText(name: string, password: string): string {
	return `WIFI:T:ADB;S:${name};P:${password};;`;
}

/**
 * Component for `am start -n`. Without an activity, `.MainActivity` is used like before.
 *
 * @param component `com.example.app/.Activity` or just the package name
 */
export function startComponent(component: string): string {
	const c = component.trim();
	return c.includes('/') ? c : `${c}/.MainActivity`;
}

/**
 * Package name for `am force-stop`.
 *
 * @param pkg package or component
 */
export function stopPackage(pkg: string): string {
	return pkg.split('/')[0].trim();
}

/**
 * Removes a leading `shell` and blanks, so `shell input keyevent 26` works as well.
 *
 * @param command command as written by the user
 */
export function cleanShellCommand(command: string): string {
	let c = command.trim();
	if (/^shell(\s|$)/.test(c)) {
		c = c.substring(5).trim();
	}
	return c;
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Some devices print warnings before the PNG data; cut everything before the PNG header.
 *
 * @param data raw output of screencap
 */
export function extractPng(data: Buffer): Buffer {
	const i = data.indexOf(PNG_HEADER);
	return i > 0 ? data.subarray(i) : data;
}

/**
 * Validates the device list from the configuration.
 * Returns the usable devices and a message for each problem.
 *
 * @param devices list from the configuration
 */
export function checkDevices(devices: DeviceConfig[] | undefined): { ok: DeviceConfig[]; problems: string[] } {
	const ok: DeviceConfig[] = [];
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const d of devices ?? []) {
		if (!d || d.enabled === false) {
			continue;
		}
		const ip = String(d.ip ?? '').trim();
		if (!ip) {
			problems.push(`Device "${d.name || '?'}" has no IP address and is skipped`);
			continue;
		}
		const port = parsePort(d.port);
		const id = deviceObjectId(ip, port);
		if (seen.has(id)) {
			problems.push(
				`Device ${ip}${port ? `:${port}` : ''} uses the same folder ${id} as another device, the second entry is skipped`,
			);
			continue;
		}
		seen.add(id);
		ok.push({ ...d, ip, port: port ?? '' });
	}
	return { ok, problems };
}

/** Automation apps that can switch wireless debugging on after a reboot, if they may write secure settings */
export const AUTOMATION_APPS: Record<string, string> = {
	'com.arlosoft.macrodroid': 'MacroDroid',
	'net.dinglisch.android.taskerm': 'Tasker',
	'com.llamalab.automate': 'Automate',
};

/**
 * Package names from the output of `pm list packages`.
 *
 * @param output command output
 */
export function parsePackages(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map(l => l.trim())
		.filter(l => l.startsWith('package:'))
		.map(l => l.substring(8).trim())
		.filter(Boolean);
}

/**
 * Checks an Android package name.
 *
 * @param pkg package name
 */
export function isPackageName(pkg: string): boolean {
	return /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(pkg);
}

/**
 * Version of the adb program from the output of `adb version`, e.g. "Version 34.0.5-debian".
 *
 * @param output command output
 */
export function parseAdbVersion(output: string): { text: string; major: number } | undefined {
	// Debian versions can carry an epoch like "1:8.1.0+r23-5"
	const m = /^Version\s+((?:\d+:)?(\d+)\.\d+\S*)/m.exec(output);
	return m ? { text: m[1], major: parseInt(m[2], 10) } : undefined;
}

/** adb version needed for pairing (wireless debugging, Android 11+) */
export const ADB_MIN_PAIRING = 30;

/**
 * Object id of a device in version 0.0.x: only the dots were replaced, so the colon stayed (`192_168_1_5:5555`).
 *
 * @param ip IP address or host name
 * @param port port
 */
export function legacyObjectId(ip: string, port: number): string {
	return `${ip.trim()}:${port}`.replace(/\./g, '_');
}

/** Values read periodically from a device */
export interface DeviceInfo {
	battery?: { present: boolean; level?: number; charging?: boolean; source?: string; temperature?: number };
	screenOn?: boolean;
	currentApp?: string;
	wifiSsid?: string;
	wifiRssi?: number;
	doNotDisturb?: boolean;
	storageFreeGB?: number;
}

/** Separator between the parts of the info command */
export const INFO_SEPARATOR = '@@adb-info@@';

/**
 * Shell command that reads all info values in one go.
 *
 * @param withStorage also read the free storage (slower, done less often)
 */
export function infoCommand(withStorage: boolean): string {
	const parts = [
		'dumpsys battery',
		'dumpsys power | grep mWakefulness=',
		"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'",
		'dumpsys wifi | grep -m1 mWifiInfo',
		'settings get global zen_mode',
	];
	if (withStorage) {
		parts.push('df /data | tail -1');
	}
	return parts.join(`; echo ${INFO_SEPARATOR}; `);
}

/**
 * Parses the output of infoCommand().
 *
 * @param output command output
 */
export function parseInfo(output: string): DeviceInfo {
	const [battery = '', power = '', window = '', wifi = '', zen = '', storage = ''] = output.split(INFO_SEPARATOR);
	const info: DeviceInfo = {};

	// only the indented lines of the current state, not the history some devices print
	const field = (name: string): string | undefined =>
		new RegExp(`^ {1,2}${name}: (.+)$`, 'mi').exec(battery)?.[1]?.trim();
	if (field('level') !== undefined) {
		const present = field('present') !== 'false';
		info.battery = { present };
		if (present) {
			const level = parseInt(field('level') ?? '', 10);
			const status = parseInt(field('status') ?? '', 10);
			const temp = parseInt(field('temperature') ?? '', 10);
			const source = ['AC', 'USB', 'Wireless', 'Dock'].find(s => field(`${s} powered`) === 'true');
			info.battery.level = Number.isNaN(level) ? undefined : level;
			// 2 = charging, 5 = full (still on the charger)
			info.battery.charging = status === 2;
			info.battery.source = source ? source.toLowerCase() : 'none';
			info.battery.temperature = Number.isNaN(temp) ? undefined : temp / 10;
		}
	}

	const wake = /mWakefulness=(\w+)/.exec(power)?.[1];
	if (wake && !/^\d+$/.test(wake)) {
		info.screenOn = wake === 'Awake';
	}

	const app =
		/mCurrentFocus=Window\{\S+ \S+ ([\w.]+)\//.exec(window)?.[1] ??
		/mFocusedApp=ActivityRecord\{\S+ \S+ ([\w.]+)\//.exec(window)?.[1];
	if (app) {
		info.currentApp = app;
	}

	if (wifi.includes('mWifiInfo')) {
		const ssid = /SSID: "([^"]*)"/.exec(wifi)?.[1];
		const rssi = parseInt(/RSSI: (-?\d+)/.exec(wifi)?.[1] ?? '', 10);
		info.wifiSsid = ssid && ssid !== '<unknown ssid>' ? ssid : '';
		if (!Number.isNaN(rssi) && rssi < 0 && rssi > -127) {
			info.wifiRssi = rssi;
		}
	}

	const z = zen.trim();
	if (/^\d+$/.test(z)) {
		info.doNotDisturb = z !== '0';
	}

	const df = storage.trim().split(/\s+/);
	if (df.length >= 4 && /^\d+$/.test(df[3])) {
		info.storageFreeGB = Math.round((parseInt(df[3], 10) / 1024 / 1024) * 10) / 10;
	}
	return info;
}
