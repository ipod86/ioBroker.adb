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

- **Wireless debugging (Android 11 and newer):** pair once – with the 6-digit pairing code or by scanning a QR code shown directly in the adapter settings. No USB cable, no fixed port.
- **Changing ports are found automatically:** the connect port of wireless debugging changes every time it is switched on (reboot, Wi-Fi reconnect). The adapter finds the current port in the network (mDNS) and connects again by itself.
- **Stays connected after a reboot:** one button lets an automation app (Tasker, MacroDroid, Automate) switch wireless debugging on again after every start – see [Stay connected after a reboot](#stay-connected-after-a-reboot).
- **Hide the debugging notification:** one switch per phone hides the permanent "Wireless debugging connected" notification.
- **Fixed port** for TV boxes and devices switched to `adb tcpip 5555`, as before.
- **Automatic reconnect** when a device was switched off, asleep or out of the network.
- **Commands:** shell command with answer, send a key, start and stop apps, reboot, screenshot.
- **Device info:** model, Android version, current port, plain-language connection status – and while connected battery, charging, screen on, app in the foreground, Wi-Fi signal, do not disturb and free storage.
- **Network search:** lists all devices that offer wireless debugging.

## Requirements

- The `adb` program on the ioBroker computer (or another computer running an adb server). Debian/Ubuntu: `sudo apt install adb`. **Pairing needs adb version 30 or newer** (`adb version`).
- Node.js 22 or newer, js-controller 6.0.11 or newer, admin 7.6.20 or newer (pairing with QR code: admin 8.3 or newer).
- The adapter starts the adb server itself when it runs on the same computer. At start it checks the adb program: if it is missing or older than version 30, a notification appears in the admin with the command to install it; the tab **adb server** shows the result of the check.
- For wireless debugging the device has to be in the same network as the adb server (not in a separate guest Wi-Fi or VLAN), because pairing and port search use mDNS.
- Pairing with QR code needs a current admin (8.3 or newer). Pairing with code works with every admin.

### Debian 12 / Raspberry Pi OS bookworm: newer adb from backports

Debian 12 (bookworm) and Raspberry Pi OS based on it ship adb version 29 – one too old for pairing (devices with a fixed port work). The newer version 34 is available from the official Debian backports, for x86 and ARM (arm64, armhf):

```bash
echo "deb http://deb.debian.org/debian bookworm-backports main" | sudo tee /etc/apt/sources.list.d/bookworm-backports.list
sudo apt update
sudo apt install -t bookworm-backports adb
adb kill-server
adb version   # should show 34.x
```

Then restart the adapter. Debian 13 (trixie) and Ubuntu 24.04 already have version 34.

## Setup

### Android 11 and newer (wireless debugging)

**Once on the device:**

1. **Settings → About phone (Samsung: → Software information) → tap "Build number" 7 times** – the developer options appear.
2. **Settings → Developer options → Wireless debugging** → switch on and confirm the question about the current Wi-Fi.

Then pair in the adapter settings, tab **Pair**, in one of two ways.

#### Pair with QR code

1. Press **Show QR code**.
2. On the device: **Wireless debugging → Pair device with QR code** and scan the code on the screen.
3. Done – the device shows "paired", the adapter adds it to the device list (port empty = automatic) and connects.

How it works: the QR code does **not** contain Wi-Fi credentials, even though it starts with `WIFI:`. It is the format Android uses for adb pairing (`WIFI:T:ADB;S:<name>;P:<password>;;`) and only carries a name and a one-time password. After scanning, the phone opens a pairing port in your normal network and announces itself via mDNS under that name. The adapter recognizes the name, connects to the phone and both check the password. Afterwards they have exchanged permanent keys – no Wi-Fi is created and nothing leaves your network.

Scan the code with the scanner in **Wireless debugging**, not with the camera app – the camera only sees a "Wi-Fi" code. The adapter waits up to 10 minutes after the code was shown; you may switch tabs or minimize the browser while scanning. **Wait for the device** only shows the result.

#### Pair with pairing code

1. On the device: **Wireless debugging → Pair device with pairing code**. The dialog shows a 6-digit code and an address like `192.168.1.20:37845`.
2. In the adapter: enter the IP address and the code and press **Pair**. The pairing port may stay empty while the dialog on the device is open – the adapter finds it itself.
3. The device is added to the device list. Save the settings.

Pairing is done only once. Later the device is connected again by itself – also after a reboot or with a new port – as soon as wireless debugging is on.

### Stay connected after a reboot

Android switches wireless debugging off at every reboot and often when the phone leaves the Wi-Fi. Pairing stays, but wireless debugging has to be switched on again. An automation app can do that by itself – it only needs a permission that normal apps don't get and that can only be given via adb:

1. Install an automation app on the device, e.g. **Tasker**, **MacroDroid** or **Automate**.
2. In the adapter settings, device list: press **Allow automation app** in the row of the device. The adapter finds the app on the device and gives it the permission `WRITE_SECURE_SETTINGS`. For another app choose it in **App for reboot** first – the list shows the apps found on the device.
3. In the app create a rule that sets the global setting `adb_wifi_enabled` to `1`.

**Example for Tasker:**

1. Tab **Profiles** → **+** → **Event** → **System** → **Device Boot** (search for "boot").
2. Back → **New Task** → name it e.g. "adb Wi-Fi on".
3. **+** → **Settings** → **Custom Setting**: Type **Global**, Name `adb_wifi_enabled`, Value `1`. Test it with ▶.
4. Optional second profile: **State** → **Net** → **Wifi Connected** (your home Wi-Fi) with the same task – for coming home.
5. On Samsung: **Settings → Apps → Tasker → Battery → Unrestricted**, otherwise Tasker may not start after the boot.

About 30–60 seconds after the phone has started, the adapter is connected again – with the new port.

**Switch wireless debugging on and off with a button on the home screen (Tasker):**

1. **Tasks** → **+** → name it e.g. "adb Wi-Fi on/off".
2. **+** → **Settings** → **Custom Setting**: Type **Global**, Name `adb_wifi_enabled`, leave Value empty, **Read Setting To** `%adb`.
3. **+** → **Settings** → **Custom Setting**: Type **Global**, Name `adb_wifi_enabled`, Value `1`, with the condition **If** `%adb` **!~** `1`.
4. **+** → **Settings** → **Custom Setting**: Type **Global**, Name `adb_wifi_enabled`, Value `0`, with the condition **If** `%adb` **~** `1`.
5. Long press on the home screen → **Widgets** → **Tasker** → **Task** (or **Task Shortcut**) → choose the task. Each tap now switches wireless debugging on or off.

Switched off, the adapter shows the device as disconnected; switched on again, it connects by itself within the check interval. Pairing is kept.

Without Tasker: **Developer options → Quick settings developer tiles → Wireless debugging** adds a tile to the quick settings panel.

Note: wireless debugging is then always on in your home network. Only devices that have been paired can connect; a new device would have to pair first, which needs the code or QR code shown on the phone.

### Device info

While a device is connected, the adapter reads a few values every 60 seconds (column **Info every** in the device list, `0` = off) into the folder `info` of the device:

| State | Description |
|---|---|
| `info.batteryLevel`, `info.charging`, `info.chargeSource`, `info.batteryTemperature` | battery level (%), charging, power source (`ac`, `usb`, `wireless`, `dock`, `none`), battery temperature (°C) – only for devices with a battery |
| `info.screenOn` | screen on |
| `info.currentApp` | package name of the app in the foreground |
| `info.wifiSsid`, `info.wifiRssi` | Wi-Fi network and signal strength (dBm) |
| `info.doNotDisturb` | "do not disturb" – can also be switched |
| `info.storageFree` | free storage (GB), read once per hour |

The values are read with one short command per interval; it does not wake the screen and costs hardly any battery. Nothing is read while the device is not connected.

### Hide the debugging notification

While connected, Android shows a permanent notification "Wireless debugging connected". It belongs to Android itself and cannot be switched off in the settings. Tick **Hide debug notice** in the row of the device in the device list (or set the state `hideNotification` to `true` – this switches it until the next adapter restart, the setting decides at start): the adapter snoozes the notification for the longest time Android allows, does it again after every connection and renews it regularly. `false` shows it again.

### TV boxes and fixed port

Enter IP address and port (usually `5555`) in the device list. For phones a fixed port can be set once via USB with `adb tcpip 5555`; on most devices it is lost after a reboot.

When connecting the first time, the device asks to **allow USB debugging** for this computer – confirm it (tick "Always allow").

## States

For each device a device object is created: `adb.0.<ip>_<port>` for a fixed port, `adb.0.<ip>` for automatic port (dots replaced by `_`). Devices set up with version 0.0.x keep their old id `adb.0.<ip>:<port>`.

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
| `hideNotification` | only wireless devices: `true` hides the notification "Wireless debugging connected" (start value from the setting "Hide debug notice") |

Screenshots are saved as files of the adapter: `/adb.0/<device id>.png` and, as before, `/adb.0/screenshot.png` (always the last one). In vis they can be shown with the URL `/files/adb.0/<device id>.png`.

## Updating from 0.0.x

Devices with a port keep their states and ids (`adb.0.<ip>:<port>`, with colon as before). The old settings are taken over. New are the states `status`, `port`, `model`, `androidVersion`, `keyevent` and – for wireless devices – `hideNotification`.

## More information

[Android Debug Bridge documentation](https://developer.android.com/tools/adb)

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**

- (ipod86) Wireless debugging (Android 11+): pairing with QR code or pairing code, automatic port discovery and reconnect
- (ipod86) Stay connected after a reboot (automation app permission), hide the debugging notification
- (ipod86) Device info: battery, charging, screen, app in the foreground, Wi-Fi, do not disturb, storage
- (ipod86) New settings page, new states, check of the adb program; existing devices and ids stay compatible
- (ipod86) Rewritten in TypeScript with current dependencies; Node.js 22+, js-controller 6+

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
