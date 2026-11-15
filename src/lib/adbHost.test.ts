import { expect } from 'chai';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { hostRequest } from './adbHost';

/**
 * Fake adb server that answers every request with the given status and text.
 *
 * @param status OKAY or FAIL
 * @param text answer text
 * @param seen receives the requests
 */
function fakeServer(status: string, text: string, seen: string[]): Promise<Server> {
	return new Promise(resolve => {
		const srv = createServer(sock => {
			sock.once('data', d => {
				seen.push(d.toString());
				const len = Buffer.byteLength(text).toString(16).padStart(4, '0');
				sock.end(status + len + text);
			});
		});
		srv.listen(0, '127.0.0.1', () => resolve(srv));
	});
}

describe('adbHost', () => {
	it('sends a length-prefixed request and returns the answer', async () => {
		const seen: string[] = [];
		const srv = await fakeServer('OKAY', 'Successfully paired to 1.2.3.4:5', seen);
		const port = (srv.address() as AddressInfo).port;
		const answer = await hostRequest('127.0.0.1', port, 'host:pair:123456:1.2.3.4:5');
		srv.close();
		expect(seen[0]).to.equal('001ahost:pair:123456:1.2.3.4:5');
		expect(answer).to.equal('Successfully paired to 1.2.3.4:5');
	});

	it('rejects with the text of a FAIL answer', async () => {
		const srv = await fakeServer('FAIL', 'unknown host service', []);
		const port = (srv.address() as AddressInfo).port;
		let err: Error | undefined;
		try {
			await hostRequest('127.0.0.1', port, 'host:pair:1:2:3');
		} catch (e) {
			err = e as Error;
		}
		srv.close();
		expect(err?.message).to.equal('unknown host service');
	});
});
