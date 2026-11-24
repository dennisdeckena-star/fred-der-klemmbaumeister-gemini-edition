# MASTER PLAN — Fred, der Klemmbaumeister (Gemini Edition)

**Vertrag:** FAS Master Execution Contract V4.3
**Zielplattform:** Windows 11 x64 (Electron + Vite + React + TypeScript + `electron-builder` NSIS)
**KI-Motor:** Ausschließlich Google Gen AI SDK (`@google/genai`), primär `gemini-4-argon` (konfigurierbar) + Google Imagen / Gemini Image
**Methodik:** BMAD → PIV → RALPH LOOP (strikt sequenziell, ein Task zur Zeit)

---

## PHASE 1: Fundament & Fotorealistische CAD-zu-PDF-Machbarkeitsprobe
- **1.1** Electron + React + TypeScript + Vite Grundgerüst, `fred-icon.png` als App-Icon, Vitest & ESLint, lauffähiger Build (`tsc`, `vite build`, `electron` Main/Preload-Bundle).
- **1.2** LDraw-Teilebibliothek: Basis-Katalog mit echten `.dat`-Geometrien (LDraw-Format), offiziellen LDraw-Farben, Noppen-/Pin-Anschlussdaten (Studs, Tubes, Technic-Pinholes, Slopes, Plates, Bricks, Tiles, Mast/Sail-Teile) & Bestellstatus-Feldern (`CONFIRMED_GEOMETRY`, `CONFIRMED_COLOR`, `ORDERABLE`, `OUT_OF_STOCK`, `DISCONTINUED`, `UNKNOWN`).
- **1.3** Three.js 3D-Workspace mit LDraw-Parser & Geometrie-Builder, PBR-ABS-Kunststoff-Materialien (`MeshPhysicalMaterial` mit Clearcoat/Roughness), Studio-Beleuchtung, Kamera/OrbitControls, Selektion, Baugruppenhierarchie, Explosionsansicht, Undo/Redo, Transformationsmatrizen und deterministischer Kollisions-/Verbindungsprüfung.
- **1.4** CAD-Toolschicht (`catalog.search_parts`, `catalog.get_part`, `model.create`, `model.add_part`, `model.remove_part`, `model.transform_part`, `model.create_assembly`, `model.save`, `model.load`, `geometry.check_collisions`, `connections.validate`, `model.validate`, `bom.generate`, `render.scene`, `render.exploded_view`, `instructions.generate_steps`, `instructions.validate`, `pdf.export`) mit strengen Zod-Eingabeschemas und vollständigen Unit-/Integrationstests.
- **1.5** Machbarkeitsprobe: Kleines Testmodell (tragender Innenkern + leichte Außenhaut + verschiedene Verbindungstypen: Noppen, Plates, Technic-Pins) per Code erzeugen, BOM berechnen und mehrseitiges, farbiges PDF mit Einzelschritten (neue Teile mit roter Kontur/Hervorhebung) exportieren und prüfen.

## PHASE 2: Fred-KI-Agent, First-Run Setup-Wizard, Konzeptstudio & UI
- **2.1** First-Run Setup-Wizard & sichere API-Anbindung: Prüfung auf gespeicherten Gemini API-Key (Electron `safeStorage` / Windows Credential Manager / DPAPI), verständliches Setup-Fenster mit Kostenwarnung, Google-AI-Studio-Anleitung und lokaler Speicherung; `@google/genai` (`gemini-4-argon`, konfigurierbar) mit Streaming, Rate-Limit-Schutz, Budget-Stopp und Offline-Testadapter.
- **2.2** Produktinterner MCP-Broker (`@modelcontextprotocol/sdk` bzw. kompatibler In-Process-MCP-Broker): Tool-Schemas, Berechtigungen, Timeouts, Audit-Log; nur getestete CAD-Tools werden für Fred freigeschaltet.
- **2.3** Konzeptstudio („Titanic-Loop“): Fotorealistische Konzeptvorschau via Google-Bildgenerierung (mit Offline-Testadapter) + iterativer Änderungs-Loop (smarte KI-Vorschläge zu Teilezahl/Detailtiefe) + explizites Freigabe-Gate (Bild ≠ 3D-Modell).
- **2.4** Fred-Desktop-UX exakt nach `ui-vorlage.png`: Helles, weiß/hellgraues 3-Spalten-Layout, Kopfzeile mit `fred-icon.png`, ballonartigem Logo „FRED - GEMINI EDITION“ und grünem „PDF EXPORT“-Button; links „MEINE BAUPLÄNE“; Mitte fotorealistischer 3D-Viewer mit Links/Rechts-Pfeilen & `SCHRITT X von Y`; rechts „FRED'S HILFE“ mit `fred-icon.png`, Sprechblasen, Eingabefeld und dezenten bunten Klemmbausteinen in den Ecken.

## PHASE 3: RAG-Wissensbasis, lernende Memory & Qualitätsschleife
- **3.1** Lokales RAG-System (SQLite FTS5 + lokale Embeddings): PDF-/Text-Import, Chunking, Seitenreferenzen, Quellenpflicht (keine Quelle = unbestätigt) und Prompt-Injection-Schutz.
- **3.2** Lernfähige Memory (`Memory.md` + SQLite-Änderungshistorie): Dauerhafte Speicherung bestätigter Nutzerpräferenzen und Korrekturen mit Versionierung, Suche, Export, Löschung und Undo.
- **3.3** Unabhängiges Validierungszentrum: Deterministische Prüfung von Teilelimit, Kollisionen, unverbundenen Teilen, Überhängen, BOM-Identität und Anleitungskonsistenz (`PASS`, `FAIL`, `NOT_TESTED`; physische Belastbarkeit ohne Probebau = `NOT_TESTED`).

## PHASE 4: Bauanleitungsstudio, Compliance & Windows-Release
- **4.1** Interaktives 3D-Bauanleitungsstudio: Schritte wählen, drehen, zoomen, Baugruppen isolieren, neue Teile hervorheben, Explosionsansicht, Baufortschritt speichern + vollständiger farbiger PDF-Export aus finaler Modellversion.
- **4.2** EU AI Act & DSGVO: `COMPLIANCE_MATRIX.md` + UI-Umsetzung für EU AI Act Art. 50 (KI-Kennzeichnung von Fred, maschinenlesbare/visuelle Markierung synthetischer Konzeptbilder) und DSGVO (lokale Datenhoheit, Export/Löschung).
- **4.3** Finale Ende-zu-Ende-Abnahme: Projekt → Setup/API-Check → Konzeptvorschau → Korrektur → Freigabe → 3D-Modell → Validierung → BOM → 3D-Anleitung → PDF → Speichern → Schließen → Wiederöffnen.
- **4.4** Windows 11 x64 Release: `electron-builder` NSIS-Installer (`Fred - Gemini Edition Setup.exe`), SHA-256 Prüfsumme, SBOM, Lizenzhinweise, Deinstallationsprüfung (soweit auf Build-Host möglich, sonst klar als `BLOCKED`/`NOT_TESTED` dokumentiert) und Abschlussbericht.
