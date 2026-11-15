# Tasker examples for wireless debugging / Tasker-Beispiele

Import in Tasker: long press on the tab **Profiles** or **Tasks** → **Import** → choose the file.
Import in Tasker: lange auf den Reiter **Profile** bzw. **Aufgaben** tippen → **Importieren** → Datei wählen.

Before: give Tasker the permission with **Grant permission** in the adapter settings (device list).
Vorher: Tasker im Adapter mit **Berechtigung geben** (Geräteliste) die Berechtigung geben.

| File | What it does |
|---|---|
| `adb_nach_Neustart.prf.xml` | Profile *Device Boot* → task `Wlan_debug`: switches wireless debugging on after every reboot and turns the button green |
| `adb_im_Heim_WLAN.prf.xml` | Profile *Wifi Connected* → task `Wlan_debug`: switches it on when the phone connects to your Wi-Fi. **Replace `MEIN_WLAN` with the name of your Wi-Fi** (in the profile: tap the condition) |
| `adb_WLAN_an_aus.tsk.xml` | Task for a home screen button: switches wireless debugging on/off, green icon = on, white = off |

Home screen button / Knopf auf dem Startbildschirm: long press on an empty spot → **Widgets** → **Tasker** → **Task** (1×1) → choose `Adb_WLAN_an_aus` → choose an icon → back arrow. The name of the widget must stay `Adb_WLAN_an_aus`, the tasks set its icon by this name.
