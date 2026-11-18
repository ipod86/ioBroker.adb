import { Socket } from 'node:net';

/** Ports Android gives wireless debugging: the dynamic port range of Linux */
export const WIRELESS_PORT_RANGE: readonly [number, number] = [32768, 60999];

/** Result of one probe */
export type ProbeResult = 'open' | 'closed' | 'timeout';

/**
 * Tries a TCP connection to one port
 *
 * @param host host
 * @param port port
 * @param timeoutMs time until a port counts as not answering
 */
export function probePort(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
	return new Promise(resolve => {
		const socket = new Socket();
		let done = false;
		const finish = (result: ProbeResult): void => {
			if (!done) {
				done = true;
				socket.destroy();
				resolve(result);
			}
		};
		socket.setTimeout(timeoutMs);
		socket.once('connect', () => finish('open'));
		socket.once('timeout', () => finish('timeout'));
		socket.once('error', (e: NodeJS.ErrnoException) => finish(e.code === 'ECONNREFUSED' ? 'closed' : 'timeout'));
		socket.connect(port, host);
	});
}

/** Options of the search */
export interface ScanOptions {
	/** first and last port */
	range?: readonly [number, number];
	/** probes at the same time */
	concurrency?: number;
	/** time until a port counts as not answering */
	timeoutMs?: number;
	/**
	 * After this many probes without a single answer (neither open nor refused) the host counts as unreachable
	 * (asleep, Wi-Fi off) and the search stops
	 */
	giveUpAfter?: number;
	/** probe function, for tests */
	probe?: (host: string, port: number, timeoutMs: number) => Promise<ProbeResult>;
}

/**
 * Open TCP ports of a host in a range - to find the port of wireless debugging where mDNS does not reach (Docker).
 * Android refuses closed ports at once, so the whole range takes a few seconds; a host that does not answer at
 * all is given up early.
 *
 * @param host host
 * @param options range, concurrency and timeouts
 * @returns the open ports, ascending; empty if none or the host does not answer
 */
export async function findOpenPorts(host: string, options: ScanOptions = {}): Promise<number[]> {
	const [from, to] = options.range ?? WIRELESS_PORT_RANGE;
	const concurrency = options.concurrency ?? 256;
	const timeoutMs = options.timeoutMs ?? 500;
	const giveUpAfter = options.giveUpAfter ?? 300;
	const probe = options.probe ?? probePort;
	const open: number[] = [];
	let next = from;
	let probed = 0;
	let answered = 0;
	let stop = false;
	const worker = async (): Promise<void> => {
		while (!stop && next <= to) {
			const port = next++;
			const result = await probe(host, port, timeoutMs);
			probed++;
			if (result !== 'timeout') {
				answered++;
			}
			if (result === 'open') {
				open.push(port);
			}
			if (!answered && probed >= giveUpAfter) {
				stop = true;
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(concurrency, to - from + 1) }, () => worker()));
	return open.sort((a, b) => a - b);
}
