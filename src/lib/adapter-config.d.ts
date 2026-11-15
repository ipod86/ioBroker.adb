// This file extends the AdapterConfig type from "@iobroker/types"

import type { DeviceConfig } from './util';

declare global {
	namespace ioBroker {
		interface AdapterConfig {
			adbHostOption: string;
			adbPortOption: string | number;
			adbPath: string;
			reconnectInterval: number;
			devices: DeviceConfig[];
		}
	}
}

export {};
