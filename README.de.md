![Logo](admin/adb.png)

# ioBroker.adb

🇬🇧 [English documentation](README.md)

## Android-Debug-Bridge-Adapter für ioBroker

Steuert Android-Geräte – Handys, Tablets, TV-Boxen, Android TV – über die Android Debug Bridge (adb).

## Highlights

- **Kabelloses Debugging (ab Android 11):** einmal koppeln – per 6-stelligem Kopplungscode oder per QR-Code, der direkt in den Adapter-Einstellungen angezeigt wird. Kein USB-Kabel, kein fester Port.
- **Wechselnde Ports werden automatisch gefunden:** Der Verbindungs-Port des kabellosen Debuggings ändert sich bei jedem Einschalten (Neustart, WLAN neu verbunden). Der Adapter findet den aktuellen Port im Netzwerk (mDNS) und verbindet sich selbst neu.
- **Bleibt nach einem Neustart verbunden:** Ein Knopf erlaubt einer Automatisierungs-App (Tasker, MacroDroid, Automate), kabelloses Debugging nach jedem Start wieder einzuschalten – siehe [Nach einem Neustart verbunden bleiben](#nach-einem-neustart-verbunden-bleiben).
- **Debugging-Benachrichtigung ausblenden:** Ein Schalter pro Handy blendet die dauerhafte Meldung „Kabelloses Debugging verbunden“ aus.
- **Fester Port** für TV-Boxen und Geräte, die mit `adb tcpip 5555` umgestellt sind, wie bisher.
- **Automatisches Wiederverbinden**, wenn ein Gerät aus, im Ruhezustand oder nicht im Netz war.
- **Befehle:** Shell-Befehl mit Antwort, Taste senden, Apps starten und beenden, Neustart, Bildschirmfoto.
- **Geräte-Infos:** Modell, Android-Version, aktueller Port, verständlicher Verbindungsstatus – und solange verbunden Akku, Laden, Bildschirm an, App im Vordergrund, WLAN-Signal, Nicht stören und freier Speicher.
- **Netzwerksuche:** findet alle Geräte, die kabelloses Debugging anbieten, und übernimmt neue gleich in die Geräteliste.

## Voraussetzungen

- Das Programm `adb` auf dem ioBroker-Rechner (oder einem anderen Rechner mit adb-Server). Debian/Ubuntu: `sudo apt install adb`. **Zum Koppeln ist adb ab Version 30 nötig** (`adb version`).
- Node.js ab 22, js-controller ab 6.0.11, Admin ab 7.6.20 (Koppeln per QR-Code: Admin ab 8.3).
- Läuft der adb-Server auf demselben Rechner, startet der Adapter ihn selbst. Beim Start prüft er das Programm adb: Fehlt es oder ist es älter als Version 30, erscheint im Admin eine Meldung mit dem Befehl zum Installieren; der Reiter **adb-Server** zeigt das Ergebnis der Prüfung.
- Für kabelloses Debugging muss das Gerät im selben Netzwerk wie der adb-Server sein (nicht in einem getrennten Gast-WLAN oder VLAN), weil Koppeln und Port-Suche über mDNS laufen.
- Koppeln per QR-Code braucht einen aktuellen Admin (ab 8.3). Koppeln per Code geht mit jedem Admin.

### Debian 12 / Raspberry Pi OS bookworm: neueres adb aus den Backports

Debian 12 (bookworm) und das darauf basierende Raspberry Pi OS liefern adb in Version 29 – eine Version zu alt zum Koppeln (Geräte mit festem Port funktionieren). Die neuere Version 34 gibt es in den offiziellen Debian-Backports, für x86 und ARM (arm64, armhf):

```bash
echo "deb http://deb.debian.org/debian bookworm-backports main" | sudo tee /etc/apt/sources.list.d/bookworm-backports.list
sudo apt update
sudo apt install -t bookworm-backports adb
adb kill-server
adb version   # sollte 34.x zeigen
```

Danach den Adapter neu starten. Debian 13 (trixie) und Ubuntu 24.04 haben bereits Version 34.

## Einrichtung

### Ab Android 11 (kabelloses Debugging)

**Einmalig am Gerät:**

1. **Einstellungen → Telefoninfo (Samsung: → Softwareinformationen) → 7 × auf „Buildnummer“ tippen** – die Entwickleroptionen erscheinen.
2. **Einstellungen → Entwickleroptionen → Kabelloses Debugging** → einschalten und die Frage zum aktuellen WLAN bestätigen.

Dann in den Adapter-Einstellungen im Reiter **Koppeln** auf einem von zwei Wegen koppeln.

#### Koppeln per QR-Code

1. **QR-Code anzeigen** drücken.
2. Am Gerät: **Kabelloses Debugging → Gerät über einen QR-Code koppeln** und den Code am Bildschirm scannen.
3. Fertig – das Gerät meldet „gekoppelt“, der Adapter trägt es in die Geräteliste ein (Port leer = automatisch) und verbindet sich.

So funktioniert es: Der QR-Code enthält **keine** WLAN-Zugangsdaten, auch wenn er mit `WIFI:` beginnt. Es ist das Format, das Android für das adb-Koppeln vorgibt (`WIFI:T:ADB;S:<Name>;P:<Kennwort>;;`), und es transportiert nur einen Namen und ein Einmal-Kennwort. Nach dem Scannen öffnet das Handy in deinem normalen Netz einen Kopplungs-Port und meldet sich per mDNS unter diesem Namen. Der Adapter erkennt den Namen, verbindet sich mit dem Handy, und beide prüfen das Kennwort. Danach haben sie dauerhafte Schlüssel ausgetauscht – es wird kein WLAN aufgebaut, und nichts verlässt dein Netz.

Den Code mit dem Scanner unter **Kabelloses Debugging** scannen, nicht mit der Kamera-App – die Kamera sieht nur einen „WLAN“-Code. Der Adapter wartet nach dem Anzeigen bis zu 10 Minuten; du darfst beim Scannen den Tab wechseln oder den Browser minimieren. **Auf das Gerät warten** zeigt nur das Ergebnis an.

#### Koppeln per Kopplungscode

1. Am Gerät: **Kabelloses Debugging → Gerät über einen Kopplungscode koppeln**. Der Dialog zeigt einen 6-stelligen Code und eine Adresse wie `192.168.1.20:37845`.
2. Im Adapter: IP-Adresse und Code eintragen und **Koppeln** drücken. Der Kopplungs-Port darf leer bleiben, solange der Dialog am Gerät offen ist – der Adapter findet ihn selbst.
3. Das Gerät wird in die Geräteliste eingetragen. Einstellungen speichern.

Gekoppelt wird nur einmal. Danach verbindet sich der Adapter von selbst wieder – auch nach einem Neustart oder mit neuem Port –, sobald kabelloses Debugging eingeschaltet ist.

### Nach einem Neustart verbunden bleiben

Android schaltet kabelloses Debugging bei jedem Neustart aus und oft auch, wenn das Handy das WLAN verlässt. Die Kopplung bleibt, aber kabelloses Debugging muss wieder eingeschaltet werden. Das kann eine Automatisierungs-App selbst erledigen – sie braucht dafür nur eine Berechtigung, die normale Apps nicht bekommen und die sich nur per adb vergeben lässt:

1. Eine Automatisierungs-App auf dem Gerät installieren, z. B. **Tasker**, **MacroDroid** oder **Automate**.
2. In den Adapter-Einstellungen in der Geräteliste in der Zeile des Geräts **Berechtigung geben** drücken (Spalte *Nach Neustart einschalten*). Der Adapter findet die App auf dem Gerät und gibt ihr die Berechtigung `WRITE_SECURE_SETTINGS`. Für eine andere App sie vorher in **Einschalt-App** auswählen – die Liste zeigt die auf dem Gerät gefundenen Apps.
3. In der App eine Regel anlegen, die die globale Einstellung `adb_wifi_enabled` auf `1` setzt.

**Beispiel für Tasker:**

Fertige Beispiele zum Importieren (Neustart-Profil, WLAN-Profil, Knopf für den Startbildschirm): [docs/tasker](https://github.com/ipod86/ioBroker.adb/tree/master/docs/tasker) – oder selbst bauen:

1. Reiter **Profile** → **+** → **Ereignis** → **System** → **Gerät gebootet** (Suche: „boot“).
2. Zurück → **Neue Aufgabe** → Name z. B. „adb WLAN an“.
3. **+** → **Einstellungen** → **Benutzerdefinierte Einstellung**: Typ **Global**, Name `adb_wifi_enabled`, Wert `1`. Mit ▶ testen.
4. Optional ein zweites Profil: **Zustand** → **Netz** → **WLAN verbunden** (dein Heimnetz) mit derselben Aufgabe – für das Heimkommen.
5. Bei Samsung: **Einstellungen → Apps → Tasker → Akku → Nicht eingeschränkt**, sonst startet Tasker nach dem Booten eventuell nicht.

Etwa 30–60 Sekunden nach dem Hochfahren ist der Adapter wieder verbunden – mit dem neuen Port.

**Kabelloses Debugging per Knopf auf dem Startbildschirm ein- und ausschalten (Tasker):**

1. **Aufgaben** → **+** → Name z. B. „adb WLAN an/aus“.
2. **+** → **Einstellungen** → **Benutzerdefinierte Einstellung**: Typ **Global**, Name `adb_wifi_enabled`, Wert leer lassen, **Einstellung lesen nach** `%adb`.
3. **+** → **Einstellungen** → **Benutzerdefinierte Einstellung**: Typ **Global**, Name `adb_wifi_enabled`, Wert `1`, mit der Bedingung **Wenn** `%adb` **!~** `1`.
4. **+** → **Einstellungen** → **Benutzerdefinierte Einstellung**: Typ **Global**, Name `adb_wifi_enabled`, Wert `0`, mit der Bedingung **Wenn** `%adb` **~** `1`.
5. Optional – der Knopf zeigt den Zustand mit seiner Farbe: **+** → **App** → **Wähle Widget Icon** (Set Widget Icon), Name = Name der Aufgabe, Icon → *Material-Symbol* → *Farbe wählen* grün (`#3DDC84`) → `android`, mit der Bedingung **Wenn** `%adb` **!~** `1`. Dieselbe Aktion noch einmal mit weißem Symbol und der Bedingung **Wenn** `%adb` **~** `1`.
6. Knopf auf den Startbildschirm legen: lange auf eine freie Stelle tippen → **Widgets** → **Tasker** → **Task** (1×1) an die Stelle ziehen → die Aufgabe wählen → ein Symbol wählen (Tasker verlangt eins) → mit dem Zurück-Pfeil bestätigen. Jeder Tipp schaltet kabelloses Debugging nun ein oder aus: **grün = an, weiß = aus**.

Der Knopf ändert seine Farbe nur, wenn er angetippt wird. Schaltet deine Regel für Neustart oder WLAN kabelloses Debugging ein, dort ebenfalls die grüne Aktion **Wähle Widget Icon** ergänzen – dann ist der Knopf auch nach einem Neustart grün.

Ausgeschaltet zeigt der Adapter das Gerät als getrennt; wieder eingeschaltet verbindet er sich innerhalb des Prüf-Intervalls von selbst. Die Kopplung bleibt erhalten.

Ohne Tasker: **Entwickleroptionen → Kacheln für Schnelleinstellungen (Entwickler) → Kabelloses Debugging** legt eine Kachel in die Schnelleinstellungen.

Hinweis: Kabelloses Debugging ist dann in deinem Heimnetz ständig an. Verbinden können sich nur gekoppelte Geräte; ein neues Gerät müsste erst koppeln, und dafür braucht es den Code oder QR-Code, den nur das Handy anzeigt.

### Geräte-Infos

Solange ein Gerät verbunden ist, liest der Adapter alle 60 Sekunden ein paar Werte in den Ordner `info` des Geräts (Spalte **Infos alle** in der Geräteliste, `0` = aus):

| Datenpunkt | Bedeutung |
|---|---|
| `info.batteryLevel`, `info.charging`, `info.chargeSource`, `info.batteryTemperature` | Akkustand (%), lädt, Stromquelle (`ac`, `usb`, `wireless`, `dock`, `none`), Akkutemperatur (°C) – nur bei Geräten mit Akku |
| `info.screenOn` | Bildschirm an |
| `info.currentApp` | Paketname der App im Vordergrund |
| `info.wifiSsid`, `info.wifiRssi` | WLAN-Netz und Signalstärke (dBm) |
| `info.doNotDisturb` | „Nicht stören“ – lässt sich auch schalten |
| `info.storageFree` | freier Speicher (GB), einmal pro Stunde gelesen |

Die Werte werden mit einem kurzen Befehl pro Intervall gelesen; das weckt den Bildschirm nicht und kostet kaum Akku. Ist das Gerät nicht verbunden, wird nichts abgefragt.

### Debugging-Benachrichtigung ausblenden

Solange eine Verbindung besteht, zeigt Android dauerhaft die Benachrichtigung „Kabelloses Debugging verbunden“. Sie gehört zu Android selbst und lässt sich in den Einstellungen nicht abschalten. In der Geräteliste in der Zeile des Geräts **Debug-Hinweis ausblenden** anhaken (oder den Datenpunkt `hideNotification` auf `true` setzen – das gilt bis zum nächsten Adapter-Neustart, beim Start entscheidet die Einstellung): Der Adapter schlummert die Benachrichtigung für die längste Zeit, die Android erlaubt, wiederholt das nach jeder Verbindung und erneuert es regelmäßig. `false` zeigt sie wieder an.

### TV-Boxen und fester Port

IP-Adresse und Port (meist `5555`) in der Geräteliste eintragen. Bei Handys lässt sich ein fester Port einmalig per USB mit `adb tcpip 5555` einstellen; bei den meisten Geräten geht er nach einem Neustart wieder verloren.

Beim ersten Verbinden fragt das Gerät, ob **USB-Debugging** für diesen Rechner erlaubt werden soll – bestätigen (Haken bei „Immer zulassen“).

## Datenpunkte

Für jedes Gerät wird ein Geräte-Objekt angelegt: `adb.0.<ip>_<port>` bei festem Port, `adb.0.<ip>` bei automatischem Port oder mit „Port wechselt“ (Punkte durch `_` ersetzt). Mit Version 0.0.x eingerichtete Geräte behalten ihre alte ID `adb.0.<ip>:<port>`.

**Docker ohne mDNS (Port des kabellosen Debuggings von Hand eingetragen):** In einem Container kommt mDNS oft nicht an, dann findet der Adapter den Port des kabellosen Debuggings nicht – und der wechselt nach jedem Neustart. Den aktuellen Port einmal eintragen und **„Port wechselt“** anhaken: Das Gerät wird dann als Gerät mit kabellosem Debugging behandelt (mit allen Funktionen dafür), die Datenpunkte liegen in `adb.0.<ip>` ohne Port, und wenn sich der Port geändert hat, sucht der Adapter den neuen selbst (er probiert die offenen Ports dieses Geräts zwischen 32768 und 60999, höchstens alle 5 Minuten; ein schlafendes Gerät gibt er nach wenigen Sekunden auf). Den alten Ordner mit Port kann man löschen (das Log nennt ihn). Alternativ den Container mit `network_mode: host` starten, dann funktioniert mDNS und der Port kann leer bleiben.

| Datenpunkt | Bedeutung |
|---|---|
| `connection` | mit dem Gerät verbunden |
| `status` | Verbindungsstatus als Text, z. B. warum eine Verbindung nicht klappt |
| `port` | aktueller Port |
| `model`, `androidVersion` | Geräte-Infos |
| `shell` | Shell-Befehl schreiben, z. B. `input keyevent 26`; die Antwort steht danach in `result` |
| `keyevent` | Taste senden: Tastencode (`26`) oder Name (`POWER`, `HOME`, `BACK`, `VOLUME_UP`, `MEDIA_PLAY_PAUSE`, …) |
| `startApp` | App starten: `com.example.app/.MainActivity`, z. B. `org.xbmc.kodi/.Splash` für Kodi |
| `stopApp` | App beenden: Paketname, z. B. `org.xbmc.kodi` |
| `reboot` | Taste: Gerät neu starten |
| `screencap` | Taste: Bildschirmfoto aufnehmen |
| `result` | Antwort des letzten Befehls oder `error: …` |
| `hideNotification` | nur kabellose Geräte: `true` blendet die Meldung „Kabelloses Debugging verbunden“ aus (Startwert aus der Einstellung „Debug-Hinweis ausblenden“) |

Bildschirmfotos werden als Dateien des Adapters gespeichert: `/adb.0/<Geräte-ID>.png` und wie bisher `/adb.0/screenshot.png` (immer das letzte). In vis lassen sie sich mit der URL `/files/adb.0/<Geräte-ID>.png` anzeigen.

## Update von 0.0.x

Geräte mit Port behalten ihre Datenpunkte und IDs (`adb.0.<ip>:<port>`, wie bisher mit Doppelpunkt). Die bisherigen Einstellungen werden übernommen. Neu sind die Datenpunkte `status`, `port`, `model`, `androidVersion`, `keyevent` und – bei kabellosen Geräten – `hideNotification`.

## Changelog

Siehe [README.md](README.md#changelog).
