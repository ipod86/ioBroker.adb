import { expect } from 'chai';
import {
	checkDevices,
	cleanShellCommand,
	deviceObjectId,
	extractPng,
	isPackageName,
	parsePackages,
	legacyObjectId,
	parseAdbVersion,
	hostOfSerial,
	isValidPairingCode,
	normalizePairingCode,
	pairingQrText,
	pairSucceeded,
	parsePort,
	portOfSerial,
	startComponent,
	stopPackage,
} from './util';

describe('util', () => {
	it('parsePort', () => {
		expect(parsePort('5555')).to.equal(5555);
		expect(parsePort(' 5555 ')).to.equal(5555);
		expect(parsePort(37000)).to.equal(37000);
		expect(parsePort('')).to.equal(undefined);
		expect(parsePort(undefined)).to.equal(undefined);
		expect(parsePort('0')).to.equal(undefined);
		expect(parsePort('70000')).to.equal(undefined);
		expect(parsePort('abc')).to.equal(undefined);
	});

	it('deviceObjectId keeps the ids of version 0.0.x and drops the port for automatic devices', () => {
		expect(deviceObjectId('192.168.99.76', 5555)).to.equal('192_168_99_76_5555');
		expect(deviceObjectId('192.168.1.20')).to.equal('192_168_1_20');
		expect(deviceObjectId('tv.local', 5555)).to.equal('tv_local_5555');
		expect(deviceObjectId('TV.local', 5555)).to.equal('tv_local_5555');
	});

	it('legacyObjectId of version 0.0.x keeps the colon', () => {
		expect(legacyObjectId('192.168.99.76', 5555)).to.equal('192_168_99_76:5555');
	});

	it('serial parts', () => {
		expect(hostOfSerial('192.168.1.20:41235')).to.equal('192.168.1.20');
		expect(portOfSerial('192.168.1.20:41235')).to.equal(41235);
		expect(hostOfSerial('R58N1234ABC')).to.equal(undefined);
		expect(hostOfSerial('adb-R58N-abc._adb-tls-connect._tcp')).to.equal(undefined);
	});

	it('pairing code', () => {
		expect(normalizePairingCode(' 123 456 ')).to.equal('123456');
		expect(normalizePairingCode('123-456')).to.equal('123456');
		expect(isValidPairingCode('123456')).to.equal(true);
		expect(isValidPairingCode('12345')).to.equal(false);
		expect(isValidPairingCode('12345a')).to.equal(false);
	});

	it('pair answer', () => {
		expect(pairSucceeded('Successfully paired to 192.168.1.20:37099 [guid=adb-R58N-abc]')).to.equal(true);
		expect(pairSucceeded('Failed: Wrong password or connection was dropped.')).to.equal(false);
	});

	it('QR text', () => {
		expect(pairingQrText('iobroker-a1b2c3', '123456')).to.equal('WIFI:T:ADB;S:iobroker-a1b2c3;P:123456;;');
	});

	it('apps', () => {
		expect(startComponent('org.xbmc.kodi/.Splash')).to.equal('org.xbmc.kodi/.Splash');
		expect(startComponent('com.example.app')).to.equal('com.example.app/.MainActivity');
		expect(stopPackage('org.xbmc.kodi/.Splash')).to.equal('org.xbmc.kodi');
		expect(stopPackage(' org.xbmc.kodi ')).to.equal('org.xbmc.kodi');
	});

	it('shell command', () => {
		expect(cleanShellCommand('shell input keyevent POWER')).to.equal('input keyevent POWER');
		expect(cleanShellCommand('input keyevent POWER')).to.equal('input keyevent POWER');
		expect(cleanShellCommand('shellscript.sh')).to.equal('shellscript.sh');
	});

	it('extractPng cuts warnings before the PNG header', () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
		expect(extractPng(Buffer.concat([Buffer.from('WARNING: x\n'), png])).equals(png)).to.equal(true);
		expect(extractPng(png).equals(png)).to.equal(true);
	});

	it('parsePackages ignores error lines', () => {
		expect(
			parsePackages(
				'package:net.dinglisch.android.taskerm\nError: java.lang.SecurityException: x\r\npackage:allterco.bg.shelly\n',
			),
		).to.deep.equal(['net.dinglisch.android.taskerm', 'allterco.bg.shelly']);
		expect(isPackageName('com.arlosoft.macrodroid')).to.equal(true);
		expect(isPackageName('kein paket')).to.equal(false);
		expect(isPackageName('x; reboot')).to.equal(false);
	});

	it('parseAdbVersion', () => {
		const out =
			'Android Debug Bridge version 1.0.41\nVersion 34.0.5-debian\nInstalled as /usr/lib/android-sdk/platform-tools/adb';
		expect(parseAdbVersion(out)).to.deep.equal({ text: '34.0.5-debian', major: 34 });
		expect(parseAdbVersion('Android Debug Bridge version 1.0.39\nVersion 1:8.1.0+r23-5')?.major).to.equal(8);
		expect(parseAdbVersion('Android Debug Bridge version 1.0.32')).to.equal(undefined);
		expect(parseAdbVersion('Version 29.0.6-6')?.major).to.equal(29);
	});

	it('checkDevices', () => {
		const { ok, problems } = checkDevices([
			{ enabled: true, name: 'TV', ip: '192.168.99.76', port: '5555' },
			{ enabled: true, name: 'Phone', ip: ' 192.168.99.80 ', port: '' },
			{ enabled: false, name: 'Off', ip: '192.168.99.81', port: '' },
			{ enabled: true, name: 'No IP', ip: '', port: '' },
			{ enabled: true, name: 'TV again', ip: '192.168.99.76', port: 5555 },
		]);
		expect(ok.map(d => d.ip)).to.deep.equal(['192.168.99.76', '192.168.99.80']);
		expect(problems).to.have.length(2);
	});
});
