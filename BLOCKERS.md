# BLOCKERS — Offene externe Abhängigkeiten & Einschränkungen

1. **Live Google Gemini / Imagen API-Key (`NOT_TESTED`):**
   - Im Entwicklungs-Workspace ist kein persönlicher Google Gemini API-Key hinterlegt.
   - Alle `@google/genai`-Integrationen, Streaming, Rate-Limit-Schutz, Budget-Stopp und Konzeptstudio-Loops werden vollständig gegen das offizielle SDK implementiert und mit einem klar gekennzeichneten `OfflineGeminiAdapter` automatisiert getestet.
   - Live-API-Aufrufe erfordern einen gültigen API-Key des Nutzers im First-Run Setup-Wizard.

2. **Host-Betriebssystem (Linux vs. Zielplattform Windows 11 x64):**
   - Der Entwicklungs-Host läuft unter Linux (x64). Native Windows-11-Ausführung und interaktive NSIS-Deinstallation auf einem realen Windows-11-System können auf diesem Host nicht direkt ausgeführt werden (`NOT_TESTED` für native Win11-Laufzeit, sofern kein Wine/NSIS-Cross-Build zur Verfügung steht).

3. **NSIS-Installer-Wrapping auf Linux-Host (`BLOCKED` – `spawn wine ENOENT`):**
   - `electron-builder --win nsis --x64` hat die vollständige Windows-11-x64-Anwendung (`release/win-unpacked/Fred - Gemini Edition.exe`, Electron 35.7.5, ASAR-Integrität, `fred-icon.ico`) erfolgreich gebaut.
   - Der abschließende NSIS-Packaging-Schritt für `release/Fred - Gemini Edition Setup.exe` benötigt auf einem Linux-Host `wine` (`Error: wine process failed ENOENT`).
   - Systemweite Paketinstallation (`sudo apt install wine64`) wurde gemäß Sicherheitsregeln nicht eigenmächtig ausgeführt.
   - **Behebung:** Entweder `npm run dist:win` direkt auf Windows 11 x64 ausführen oder nach ausdrücklicher Freigabe `wine64` auf dem Linux-Host installieren und `npm run dist:win` erneut starten.
   - **Deinstallationsprüfung:** Auf Linux-Host `NOT_TESTED` (erfordert reales Windows-11-x64-Zielsystem).
