# RELEASE CHECKLIST — Windows 11 x64

- [x] Phase 1 vollständig `PASS` (Grundgerüst, LDraw-Katalog, 3D-CAD, 18 Tools, Machbarkeitsprobe PDF)
- [x] Phase 2 vollständig `PASS` (Setup-Wizard, `@google/genai`, MCP-Broker, Konzeptstudio, UI nach `ui-vorlage.png`)
- [x] Phase 3 vollständig `PASS` (RAG SQLite FTS5, Memory.md + Historie, Validierungszentrum)
- [x] Phase 4.1–4.3 vollständig `PASS` (3D-Anleitungsstudio, EU AI Act & DSGVO, E2E-Abnahme)
- [x] `tsc --noEmit` fehlerfrei
- [x] `vite build` & Electron-Main-Build fehlerfrei (keine Node-External-Warnungen im Renderer)
- [x] Vollständige Vitest Test-Suite grün (13/13 Testdateien, 26/26 Tests)
- [x] Windows 11 x64 Anwendungspaket erzeugt (`release/win-unpacked/Fred - Gemini Edition.exe`)
- [ ] `electron-builder` Windows x64 NSIS-Installer (`Fred - Gemini Edition Setup.exe`) — **BLOCKED auf Linux-Host (`spawn wine ENOENT`)**
- [x] SHA-256 Prüfsumme erstellt (`release/SHA256SUMS.txt`)
- [x] SBOM (`release/sbom.json`, CycloneDX 1.5, 581 Pakete) & Lizenzhinweise (`release/THIRD_PARTY_LICENSES.md`) erzeugt
- [ ] Deinstallationsprüfung auf Windows 11 x64 — **`NOT_TESTED` (Linux-Host)**
