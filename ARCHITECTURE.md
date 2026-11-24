# ARCHITECTURE — Fred, der Klemmbaumeister (Gemini Edition)

## 1. Systemüberblick & Produktisolation
Fred ist eine lokale Windows-11-Desktop-Anwendung auf Basis von Electron + React + TypeScript + Vite.
**Produktisolation:** Ausschließlich `@google/genai` (Google Gemini & Imagen). Keine OpenAI-SDKs, keine fremden LLM-Provider, keine unautorisierten Netzwerkaufrufe.

## 2. Schichten & Modulgrenzen
```
src/
├── main/                   # Electron Main Process (Node.js)
│   ├── index.ts            # Fenster, App-Icon, IPC-Registrierung, Lifecycle
│   ├── preload.ts          # Context-Isolated IPC-Bridge (window.fredApi)
│   ├── secrets.ts          # Sichere API-Key-Verwaltung (Electron safeStorage / DPAPI)
│   ├── storage/            # SQLite (better-sqlite3 / node:sqlite) für Projekte, RAG, Memory, Audit
│   └── ipc.ts              # Streng typisierte IPC-Handler
├── core/                   # Deterministische, headless-testbare Fachlogik (kein DOM-Zwang)
│   ├── ldraw/              # LDraw-Standard (.dat/.ldr Parser, Basis-Teilekatalog, Farbpalette, Konnektoren)
│   ├── cad/                # 3D-Datenmodell, Transformationsmatrizen, Baugruppen, Undo/Redo, Kollision & Verbindungen
│   ├── tools/              # 18 geprüfte CAD-Tools mit Zod-Schemas
│   ├── pdf/                # Deterministischer PDF-Generator (pdf-lib) + Schritt-Renderer
│   ├── mcp/                # Produktinterner MCP-Broker (Schemas, Permissions, Timeouts, Audit-Log)
│   ├── ai/                 # Google Gen AI Adapter (@google/genai, Streaming, Rate-Limit, Budget, Offline-Adapter)
│   ├── concept/            # Konzeptstudio (Imagen/Gemini Image + Änderungs-Loop + Freigabe-Gate)
│   ├── rag/                # SQLite FTS5 + lokale Embeddings, PDF-Chunking, Quellenpflicht, Injection-Filter
│   ├── memory/             # Memory.md + SQLite-Historie (Versionierung, Suche, Export, Löschung, Undo)
│   └── validation/         # Unabhängiges Validierungszentrum (PASS / FAIL / NOT_TESTED)
└── renderer/               # React + Three.js UI (strikt nach ui-vorlage.png)
    ├── App.tsx             # 3-Spalten-Layout + Header + Modals (Setup-Wizard, Konzeptstudio, Validierung, Compliance)
    ├── components/
    │   ├── Header.tsx      # fred-icon.png, Ballon-Logo "FRED - GEMINI EDITION", grüner "PDF EXPORT"-Button
    │   ├── BlueprintList.tsx # Links: "MEINE BAUPLÄNE" mit Vorschaubildern
    │   ├── Viewport3D.tsx  # Mitte: Three.js PBR ABS-Shader, Studio-Light, Pfeile, "SCHRITT X von Y", Explosionsansicht
    │   ├── FredChat.tsx    # Rechts: "FRED'S HILFE" mit fred-icon.png, Sprechblasen, EU-AI-Act-Kennzeichnung
    │   ├── SetupWizard.tsx # First-Run API-Key-Wizard mit Kostenwarnung & AI-Studio-Anleitung
    │   ├── ConceptStudio.tsx # Konzeptvorschau + iterativer Loop + Freigabe-Gate
    │   └── InspectorDrawer.tsx # Validierungszentrum, BOM, RAG-Wissen, Memory.md, Datenschutz/DSGVO
    └── styles/             # Helles weiß/hellgraues Designsystem (keine dunklen Cyber-Themes)
```

## 3. LDraw- & Geometrie-Vertrag
- Einheiten: LDraw Units (LDU). 1 Stud-Abstand = 20 LDU, 1 Brick-Höhe = 24 LDU, 1 Plate-Höhe = 8 LDU.
- Alle Teile basieren auf echten `.dat`-Geometrien (LDraw Line Types 0–5: Kommentare, Subfile-Referenzen, Linien, Dreiecke, Quads, optionale Linien).
- Jeder Katalogeintrag trägt explizite Metadaten: `partId`, `name`, `category`, `datContent`, `dimensionsLdu`, `connectors` (`stud`, `tube`, `pin_hole`, `axle_hole`, `clip`, `bar`), sowie Bestellstatus-Felder (`CONFIRMED_GEOMETRY`, `CONFIRMED_COLOR`, `ORDERABLE`, `OUT_OF_STOCK`, `DISCONTINUED`, `UNKNOWN`).
- Deterministische Kollisionsprüfung: OBB/AABB-Überschneidung mit 0.5 LDU Toleranz (Noppen-In-Tube-Eingriff erlaubt, Volumenkollision = `FAIL`).
- Verbindungsprüfung: Graph über passende Gegen-Konnektoren (`stud` ↔ `tube`, `pin` ↔ `pin_hole`) innerhalb Toleranz; unverbundene Inseln werden gemeldet.

## 4. MCP-Broker-Vertrag
- Alle 18 CAD-Tools sind über ein zentrales Tool-Registry-Schema (Zod + JSON Schema) registriert.
- Jede Ausführung durchläuft: Berechtigungsprüfung → Schema-Validierung → Timeout-Schutz → Ausführung → Audit-Log-Eintrag (Zeitstempel, Tool, Argument-Hash, Status, Dauer).
- Fred darf keine freien Shell- oder Dateisystembefehle ausführen.

## 5. Sicherheits-, Datenschutz- & Compliance-Vertrag
- API-Keys werden niemals im Klartext in Projektdateien oder Git abgelegt; Speicherung ausschließlich über Electron `safeStorage` (Windows DPAPI / Credential Manager) mit lokalem Fallback-Hinweis für Headless-Tests.
- EU AI Act Art. 50: Fred ist sichtbar als KI-System gekennzeichnet; synthetische Konzeptbilder tragen ein sichtbares Kennzeichen sowie eingebettete maschinenlesbare Metadaten (`ai_generated: true`, Modell, Zeitstempel).
- DSGVO: 100 % lokale Projekt-, RAG- und Memory-Datenhaltung mit Export- und Löschfunktion.
