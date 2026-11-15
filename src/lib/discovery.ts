import { Bonjour, type Browser, type Service } from 'bonjour-service';

/** An Android device announcing wireless debugging in the network */
export interface FoundService {
	/** service instance name, e.g. `adb-R58N1234ABC-x1y2z3` */
	name: string;
	/** IPv4 address */
	ip: string;
	port: number;
	/** time of last announcement */
	seen: number;
}

const CONNECT = 'adb-tls-connect';
const PAIRING = 'adb-tls-pairing';

/**
 * Listens for the mDNS announcements of Android 11+ wireless debugging.
 * The connect port changes each time wireless debugging is switched on, so it is looked up here.
 */
export class Discovery {
	private bonjour?: Bonjour;
	private browsers: Browser[] = [];
	private connect = new Map<string, FoundService>();
	private pairing = new Map<string, FoundService>();
	private waiters: {
		match: (s: FoundService) => boolean;
		resolve: (s: FoundService) => void;
		timer?: ioBroker.Timeout;
	}[] = [];

	/**
	 * @param log logger
	 * @param log.debug debug output
	 * @param log.warn warning output
	 * @param adapter adapter, its timers are cleared automatically on unload
	 */
	constructor(
		private readonly log: { debug: (m: string) => void; warn: (m: string) => void },
		private readonly adapter: Pick<ioBroker.Adapter, 'setTimeout' | 'clearTimeout'>,
	) {}

	/** Starts listening */
	start(): void {
		try {
			this.bonjour = new Bonjour(undefined, (err: unknown) => {
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
	private browse(type: string, map: Map<string, FoundService>): Browser {
		const browser = this.bonjour!.find({ type, protocol: 'tcp' });
		const add = (s: Service): void => {
			const ip = pickIPv4(s);
			if (!ip || !s.port) {
				return;
			}
			const found: FoundService = { name: s.name, ip, port: s.port, seen: Date.now() };
			map.set(s.name, found);
			this.log.debug(`mDNS ${type}: ${s.name} at ${ip}:${s.port}`);
			if (type === PAIRING) {
				this.waiters = this.waiters.filter(w => {
					if (w.match(found)) {
						w.resolve(found);
						return false;
					}
					return true;
				});
			}
		};
		browser.on('up', add);
		browser.on('srv-update', add);
		browser.on('down', (s: Service) => {
			map.delete(s.name);
			this.log.debug(`mDNS ${type}: ${s.name} gone`);
		});
		return browser;
	}

	/** Sends a new query, so devices answer at once instead of at their next announcement */
	refresh(): void {
		for (const b of this.browsers) {
			try {
				b.update();
			} catch {
				// ignore
			}
		}
	}

	/**
	 * Current connect port of a device.
	 *
	 * @param ip IP address of the device
	 */
	connectPort(ip: string): number | undefined {
		return this.latest(this.connect, s => s.ip === ip)?.port;
	}

	/**
	 * Forgets an announced connect port that refused the connection
	 * (wireless debugging was switched off without a goodbye in the network).
	 *
	 * @param ip IP address of the device
	 * @param port port that refused the connection
	 */
	forgetConnect(ip: string, port: number): void {
		for (const [name, s] of this.connect) {
			if (s.ip === ip && s.port === port) {
				this.connect.delete(name);
				this.log.debug(`mDNS adb-tls-connect: ${name} (${ip}:${port}) refused the connection, forgotten`);
			}
		}
	}

	/**
	 * Pairing port of a device that currently shows the "pair with code" dialog.
	 *
	 * @param ip IP address of the device
	 */
	pairingPort(ip: string): number | undefined {
		return this.latest(this.pairing, s => s.ip === ip)?.port;
	}

	/** All devices that announce wireless debugging */
	devices(): FoundService[] {
		return [...this.connect.values()].sort((a, b) => a.ip.localeCompare(b.ip));
	}

	/**
	 * Waits until a phone announces a pairing service that matches.
	 *
	 * @param match filter
	 * @param timeoutMs time limit
	 */
	waitForPairing(match: (s: FoundService) => boolean, timeoutMs: number): Promise<FoundService | undefined> {
		const existing = this.latest(this.pairing, match);
		if (existing) {
			return Promise.resolve(existing);
		}
		return new Promise(resolve => {
			const waiter: (typeof this.waiters)[number] = {
				match,
				resolve: (s: FoundService): void => {
					this.adapter.clearTimeout(waiter.timer);
					resolve(s);
				},
			};
			waiter.timer = this.adapter.setTimeout(() => {
				this.waiters = this.waiters.filter(w => w !== waiter);
				resolve(undefined);
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
	private latest(map: Map<string, FoundService>, match: (s: FoundService) => boolean): FoundService | undefined {
		let best: FoundService | undefined;
		for (const s of map.values()) {
			if (match(s) && (!best || s.seen > best.seen)) {
				best = s;
			}
		}
		return best;
	}

	/** Stops listening */
	stop(): void {
		for (const b of this.browsers) {
			try {
				b.stop();
			} catch {
				// ignore
			}
		}
		this.browsers = [];
		for (const w of this.waiters) {
			this.adapter.clearTimeout(w.timer);
		}
		this.waiters = [];
		try {
			this.bonjour?.destroy();
		} catch {
			// ignore
		}
		this.bonjour = undefined;
	}
}

/**
 * IPv4 address of an announcement.
 *
 * @param s announcement
 */
function pickIPv4(s: Service): string | undefined {
	const v4 = (s.addresses ?? []).find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
	if (v4) {
		return v4;
	}
	const ref = s.referer?.address;
	return ref && /^\d+\.\d+\.\d+\.\d+$/.test(ref) ? ref : undefined;
}
