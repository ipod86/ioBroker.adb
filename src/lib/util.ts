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
	const base = port ? `${ip.trim()}:${port}` : ip.trim();
	return base.replace(/[.:]/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
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
			problems.push(`Device ${ip}${port ? `:${port}` : ''} is listed twice, the second entry is skipped`);
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
