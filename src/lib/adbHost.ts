import { Socket } from 'node:net';

/**
 * Sends one host service request to the adb server and returns the answer text.
 * Used for requests the adb library does not offer, like `host:pair`.
 *
 * Protocol: request = 4 hex digits length + text; answer = OKAY|FAIL + 4 hex digits length + text.
 *
 * @param host adb server host
 * @param port adb server port
 * @param request request text, e.g. `host:pair:123456:192.168.1.5:37123`
 * @param timeoutMs time limit
 */
export function hostRequest(host: string, port: number, request: string, timeoutMs = 30000): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = new Socket();
		let buf = Buffer.alloc(0);
		let done = false;
		const finish = (err: Error | null, text?: string): void => {
			if (done) {
				return;
			}
			done = true;
			socket.destroy();
			if (err) {
				reject(err);
			} else {
				resolve(text ?? '');
			}
		};
		const tryParse = (final: boolean): void => {
			if (buf.length < 4) {
				if (final) {
					finish(new Error('adb server closed the connection without an answer'));
				}
				return;
			}
			const status = buf.subarray(0, 4).toString('ascii');
			if (status !== 'OKAY' && status !== 'FAIL') {
				finish(new Error(`Unexpected answer from adb server: ${status}`));
				return;
			}
			if (buf.length < 8) {
				if (final) {
					finish(status === 'OKAY' ? null : new Error('adb server refused the request'), '');
				}
				return;
			}
			const len = parseInt(buf.subarray(4, 8).toString('ascii'), 16);
			if (Number.isNaN(len)) {
				finish(new Error('Invalid answer length from adb server'));
				return;
			}
			if (buf.length < 8 + len) {
				if (final) {
					finish(new Error('adb server answer was cut off'));
				}
				return;
			}
			const text = buf.subarray(8, 8 + len).toString('utf8');
			finish(status === 'OKAY' ? null : new Error(text || 'adb server refused the request'), text);
		};

		socket.setTimeout(timeoutMs, () => finish(new Error('No answer from adb server (timeout)')));
		socket.on('error', err => finish(err));
		socket.on('data', chunk => {
			buf = Buffer.concat([buf, chunk]);
			tryParse(false);
		});
		socket.on('end', () => tryParse(true));
		socket.on('close', () => tryParse(true));
		socket.connect(port, host, () => {
			const len = Buffer.byteLength(request, 'utf8').toString(16).padStart(4, '0');
			socket.write(len + request);
		});
	});
}
