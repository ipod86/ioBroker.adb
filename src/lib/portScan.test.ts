import { expect } from 'chai';
import { findOpenPorts, type ProbeResult } from './portScan';

/**
 * a device that answers: these ports are open, all others refuse at once
 *
 * @param open the open ports
 */
const device =
	(open: number[]) =>
	(_host: string, port: number): Promise<ProbeResult> =>
		Promise.resolve(open.includes(port) ? 'open' : 'closed');

describe('portScan', () => {
	it('finds the open ports of the range, ascending', async () => {
		const ports = await findOpenPorts('x', { range: [37000, 38000], probe: device([37175, 37020]) });
		expect(ports).to.deep.equal([37020, 37175]);
	});

	it('looks at every port of the range once', async () => {
		const seen: number[] = [];
		await findOpenPorts('x', {
			range: [40000, 40099],
			concurrency: 7,
			probe: (_h, port) => {
				seen.push(port);
				return Promise.resolve('closed');
			},
		});
		expect(seen.sort((a, b) => a - b)).to.deep.equal(Array.from({ length: 100 }, (_v, i) => 40000 + i));
	});

	it('gives up early when the host does not answer at all (asleep, Wi-Fi off)', async () => {
		let probed = 0;
		const ports = await findOpenPorts('x', {
			range: [32768, 60999],
			concurrency: 10,
			giveUpAfter: 50,
			probe: () => {
				probed++;
				return Promise.resolve('timeout');
			},
		});
		expect(ports).to.deep.equal([]);
		expect(probed).to.be.below(100);
	});

	it('keeps searching when some ports do not answer but others refuse', async () => {
		const ports = await findOpenPorts('x', {
			range: [45000, 45999],
			giveUpAfter: 50,
			probe: (_h, port) => Promise.resolve(port === 45900 ? 'open' : port % 2 ? 'timeout' : 'closed'),
		});
		expect(ports).to.deep.equal([45900]);
	});
});
