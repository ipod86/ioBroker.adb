![Logo](admin/adb.png)

# ioBroker.adb

🇬🇧 [English documentation](README.md)

## Android-Debug-Bridge-Adapter für ioBroker

Steuert Android-Geräte – Handys, Tablets, TV-Boxen, Android TV – über die Android Debug Bridge (adb).

## Highlights

- **Kabelloses Debugging (ab Android 11):** einmal koppeln, per 6-stelligem Kopplungscode oder per QR-Code direkt in den Adapter-Einstellungen. Der Verbindungs-Port des kabellosen Debuggings ändert sich bei jedem Einschalten – der Adapter findet den aktuellen Port selbst im Netzwerk und verbindet sich neu.
- **Fester Port** für TV-Boxen und Geräte, die mit `adb tcpip 5555` umgestellt sind, wie bisher.
- **Automatisches Wiederverbinden**, wenn ein Gerät aus, im Ruhezustand oder nicht im Netz war.
- **Befehle:** Shell-Befehl mit Antwort, Taste senden, Apps starten und beenden, Neustart, Bildschirmfoto.
- **Geräte-Infos:** Modell, Android-Version, aktueller Port und ein verständlicher Verbindungsstatus.
- **Netzwerksuche:** zeigt alle Geräte, die kabelloses Debugging anbieten.

## Voraussetzungen

- Das Programm `adb` auf dem ioBroker-Rechner (oder einem anderen Rechner mit adb-Server). Debian/Ubuntu: `sudo apt install adb`. **Zum Koppeln ist adb ab Version 30 nötig** (`adb version`).
- Läuft der adb-Server auf demselben Rechner, startet der Adapter ihn selbst.
- Für kabelloses Debugging muss das Gerät im selben Netzwerk wie der adb-Server sein, weil der Port per mDNS gefunden wird.
- Koppeln per QR-Code braucht einen aktuellen Admin (ab 8.3). Koppeln per Code geht mit jedem Admin.

## Einrichtung

### Ab Android 11 (kabelloses Debugging)

1. Auf dem Gerät: **Einstellungen → Telefoninfo → Softwareinformationen → 7 × auf „Buildnummer“ tippen**, damit die Entwickleroptionen erscheinen.
2. **Einstellungen → Entwickleroptionen → Kabelloses Debugging** → einschalten.
3. In den Adapter-Einstellungen im Reiter **Koppeln** einen Weg wählen:
   - **Kopplungscode:** Auf dem Gerät *Gerät über einen Kopplungscode koppeln* antippen. IP-Adresse und 6-stelligen Code eintragen und **Koppeln** drücken. Der Kopplungs-Port darf leer bleiben, solange der Dialog auf dem Gerät offen ist.
   - **QR-Code:** **QR-Code anzeigen** drücken, dann **Auf das Gerät warten**. Auf dem Gerät *Gerät über einen QR-Code koppeln* antippen und scannen.
4. Das Gerät wird mit leerem Port (= automatisch) in die Geräteliste eingetragen. Einstellungen speichern.

Gekoppelt wird nur einmal. Danach verbindet sich der Adapter von selbst wieder – auch nach einem Neustart oder mit neuem Port –, sobald kabelloses Debugging eingeschaltet ist.

**Hinweis:** Viele Geräte schalten kabelloses Debugging nach einem Neustart oder beim Verlassen des WLANs aus. Dann muss es auf dem Gerät wieder eingeschaltet werden; neu koppeln ist nicht nötig.

### TV-Boxen und fester Port

IP-Adresse und Port (meist `5555`) in der Geräteliste eintragen. Bei Handys lässt sich ein fester Port einmalig per USB mit `adb tcpip 5555` einstellen; bei den meisten Geräten geht er nach einem Neustart wieder verloren.

Beim ersten Verbinden fragt das Gerät, ob **USB-Debugging** für diesen Rechner erlaubt werden soll – bestätigen (Haken bei „Immer zulassen“).

## Datenpunkte

Für jedes Gerät wird ein Geräte-Objekt angelegt: `adb.0.<ip>_<port>` bei festem Port, `adb.0.<ip>` bei automatischem Port.

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

Bildschirmfotos werden als Dateien des Adapters gespeichert: `/adb.0/<Geräte-ID>.png` und wie bisher `/adb.0/screenshot.png` (immer das letzte). In vis lassen sie sich mit der URL `/files/adb.0/<Geräte-ID>.png` anzeigen.

## Update von 0.0.x

Geräte mit Port behalten ihre Datenpunkte und IDs. Die bisherigen Einstellungen werden übernommen. Neu sind die Datenpunkte `status`, `port`, `model`, `androidVersion` und `keyevent`.

## Changelog

Siehe [README.md](README.md#changelog).
