![Logo](admin/adb.png)

# ioBroker.adb

[![NPM version](https://img.shields.io/npm/v/iobroker.adb.svg)](https://www.npmjs.com/package/iobroker.adb)
[![Downloads](https://img.shields.io/npm/dm/iobroker.adb.svg)](https://www.npmjs.com/package/iobroker.adb)
![Number of Installations](https://iobroker.live/badges/adb-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/adb-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.adb.png?downloads=true)](https://nodei.co/npm/iobroker.adb/)

**Tests:** ![Test and Release](https://github.com/ipod86/ioBroker.adb/workflows/Test%20and%20Release/badge.svg)

🇩🇪 [Deutsche Anleitung](README.de.md)

## Android Debug Bridge adapter for ioBroker

Control Android devices – phones, tablets, TV boxes, Android TV – through the Android Debug Bridge (adb).

## Highlights

- **Wireless debugging (Android 11 and newer):** pair once with the 6-digit pairing code or by scanning a QR code in the adapter settings. The connect port of wireless debugging changes every time it is switched on – the adapter finds the current port in the network by itself and connects again.
- **Fixed port** for TV boxes and devices switched to `adb tcpip 5555`, as before.
- **Automatic reconnect** when a device was switched off, asleep or out of the network.
- **Commands:** shell command with answer, send a key, start and stop apps, reboot, screenshot.
- **Device info:** model, Android version, current port and a plain-language connection status.
- **Network search:** lists all devices that announce wireless debugging.

## Requirements

- The `adb` program on the ioBroker computer (or another computer running an adb server). Debian/Ubuntu: `sudo apt install adb`. **Pairing needs adb version 30 or newer** (`adb version`).
- The adapter starts the adb server itself when it runs on the same computer.
- For wireless debugging the device has to be in the same network as the adb server, because the port is found via mDNS.
- Pairing with QR code needs a current admin (8.3 or newer). Pairing with code works with every admin.

## Setup

### Android 11 and newer (wireless debugging)

1. On the device: **Settings → About phone → tap "Build number" 7 times** to unlock the developer options.
2. **Settings → Developer options → Wireless debugging** → switch on.
3. In the adapter settings, tab **Pair**, choose one way:
   - **Pairing code:** on the device tap *Pair device with pairing code*. Enter the IP address and the 6-digit code and press **Pair**. The pairing port can stay empty while the dialog on the device is open.
   - **QR code:** press **Show QR code**, then **Wait for the device**. On the device tap *Pair device with QR code* and scan it.
4. The device is added to the device list with an empty port (= automatic). Save the settings.

Pairing is done once. Later the device is connected again by itself – also after a reboot or a new port – as soon as wireless debugging is on.

**Note:** Many devices switch wireless debugging off after a reboot or when they leave the Wi-Fi. Then it has to be switched on again on the device; a new pairing is not needed.

### TV boxes and fixed port

Enter IP address and port (usually `5555`) in the device list. For phones a fixed port can be set once via USB with `adb tcpip 5555`; on most devices it is lost after a reboot.

When connecting the first time, the device asks to **allow USB debugging** for this computer – confirm it (tick "Always allow").

## States

For each device a device object is created: `adb.0.<ip>_<port>` for a fixed port, `adb.0.<ip>` for automatic port.

| State | Description |
|---|---|
| `connection` | connected to the device |
| `status` | connection status as text, e.g. why a connection failed |
| `port` | current port |
| `model`, `androidVersion` | device info |
| `shell` | write a shell command, e.g. `input keyevent 26`; the answer is written to `result` |
| `keyevent` | send a key: key code (`26`) or name (`POWER`, `HOME`, `BACK`, `VOLUME_UP`, `MEDIA_PLAY_PAUSE`, …) |
| `startApp` | start an app: `com.example.app/.MainActivity`, e.g. `org.xbmc.kodi/.Splash` for Kodi |
| `stopApp` | stop an app: package name, e.g. `org.xbmc.kodi` |
| `reboot` | button: reboot the device |
| `screencap` | button: take a screenshot |
| `result` | answer of the last command, or `error: …` |

Screenshots are saved as files of the adapter: `/adb.0/<device id>.png` and, as before, `/adb.0/screenshot.png` (always the last one). In vis they can be shown with the URL `/files/adb.0/<device id>.png`.

## Updating from 0.0.x

Devices with a port keep their states and ids. The old settings are taken over. New are the states `status`, `port`, `model`, `androidVersion` and `keyevent`.

## More information

[Android Debug Bridge documentation](https://developer.android.com/tools/adb)

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**

- (ipod86) Wireless debugging (Android 11+): pair with pairing code or QR code; changing ports are found automatically via mDNS
- (ipod86) New settings page (jsonConfig), network search for devices
- (ipod86) Automatic reconnect, new states `status`, `port`, `model`, `androidVersion`, `keyevent`; screenshots per device
- (ipod86) Rewritten in TypeScript, current adapter-core, adbkit 4, Node.js 22 or newer, js-controller 6 or newer
- (ipod86) "localhost" no longer resolves to IPv6 (adb server only listens on IPv4); clear message if the adb program is missing

### 0.0.7

- (om2804) Add meta object for fix screenshot

### 0.0.6

- (om2804) Add delete and up/down buttons in device list.
- (om2804) Replace dependency 'adbkit'. Active development has been moved to DeviceFarmer organisation.
- (om2804) Add wait for device after connection.

### 0.0.5

- (om2804) js-controller dependency upgraded to > 2.0.0

### 0.0.3

- (om2804) fixes after review

### 0.0.2

- (om2804) start/stop application
- (om2804) reboot device
- (om2804) take screenshot

### 0.0.1

- (om2804) initial release

## License

MIT License

Copyright (c) 2020-2026 om2804 <om2804@mail.ru>, ipod86 <david@graef.email>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
