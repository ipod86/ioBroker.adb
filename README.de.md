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
- **Geräte-Infos:** Modell, Android-Version, aktueller Port und ein verständlicher Verbindungsstatus.
- **Netzwerksuche:** zeigt alle Geräte, die kabelloses Debugging anbieten.

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
2. In den Adapter-Einstellungen in der Geräteliste in der Zeile des Geräts **Automatisierungs-App erlauben** drücken. Der Adapter findet die App auf dem Gerät und gibt ihr die Berechtigung `WRITE_SECURE_SETTINGS`. Für eine andere App sie vorher in **App für Neustart** auswählen – die Liste zeigt die auf dem Gerät gefundenen Apps.
3. In der App eine Regel anlegen, die die globale Einstellung `adb_wifi_enabled` auf `1` setzt.

**Beispiel für Tasker:**

1. Reiter **Profile** → **+** → **Ereignis** → **System** → **Gerät gebootet** (Suche: „boot“).
2. Zurück → **Neue Aufgabe** → Name z. B. „adb WLAN an“.
3. **+** → **Einstellungen** → **Benutzerdefinierte Einstellung**: Typ **Global**, Name `adb_wifi_enabled`, Wert `1`. Mit ▶ testen.
4. Optional ein zweites Profil: **Zustand** → **Netz** → **WLAN verbunden** (dein Heimnetz) mit derselben Aufgabe – für das Heimkommen.
5. Bei Samsung: **Einstellungen → Apps → Tasker → Akku → Nicht eingeschränkt**, sonst startet Tasker nach dem Booten eventuell nicht.

Etwa 30–60 Sekunden nach dem Hochfahren ist der Adapter wieder verbunden – mit dem neuen Port.

Hinweis: Kabelloses Debugging ist dann in deinem Heimnetz ständig an. Verbinden können sich nur gekoppelte Geräte; ein neues Gerät müsste erst koppeln, und dafür braucht es den Code oder QR-Code, den nur das Handy anzeigt.

### Debugging-Benachrichtigung ausblenden

Solange eine Verbindung besteht, zeigt Android dauerhaft die Benachrichtigung „Kabelloses Debugging verbunden“. Sie gehört zu Android selbst und lässt sich in den Einstellungen nicht abschalten. In der Geräteliste in der Zeile des Geräts **Debug-Hinweis ausblenden** anhaken (oder den Datenpunkt `hideNotification` auf `true` setzen – das gilt bis zum nächsten Adapter-Neustart, beim Start entscheidet die Einstellung): Der Adapter schlummert die Benachrichtigung für die längste Zeit, die Android erlaubt, wiederholt das nach jeder Verbindung und erneuert es regelmäßig. `false` zeigt sie wieder an.

### TV-Boxen und fester Port

IP-Adresse und Port (meist `5555`) in der Geräteliste eintragen. Bei Handys lässt sich ein fester Port einmalig per USB mit `adb tcpip 5555` einstellen; bei den meisten Geräten geht er nach einem Neustart wieder verloren.

Beim ersten Verbinden fragt das Gerät, ob **USB-Debugging** für diesen Rechner erlaubt werden soll – bestätigen (Haken bei „Immer zulassen“).

## Datenpunkte

Für jedes Gerät wird ein Geräte-Objekt angelegt: `adb.0.<ip>_<port>` bei festem Port, `adb.0.<ip>` bei automatischem Port (Punkte durch `_` ersetzt). Mit Version 0.0.x eingerichtete Geräte behalten ihre alte ID `adb.0.<ip>:<port>`.

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
