# DECISIONS — Architekturentscheidungen

## DEC-001: SQLite-Treiber (`node:sqlite` vs. `better-sqlite3`)
- **Kontext:** Node.js v22.23.2 ist auf dem Build-Host installiert und bringt `node:sqlite` (`DatabaseSync`) mit FTS5-Unterstützung nativ mit; alternativ existiert `better-sqlite3` (C++-Addon, das für Electron/Windows-Cross-Compile Rebuild erfordert).
- **Entscheidung:** Wir prüfen in Phase 3.1, ob `node:sqlite` im Electron-Runtime verfügbar ist oder nutzen eine reine SQLite-Schicht (z. B. `sql.js` mit FTS5 bzw. `better-sqlite3` / `node:sqlite` mit einheitlichem Repository-Interface), damit sowohl Vitest-Tests auf Linux als auch der Windows-11-x64-Electron-Build ohne native ABI-Brüche laufen.

## DEC-002: Deterministischer PDF-Export (`pdf-lib`)
- **Entscheidung:** Verwendung von `pdf-lib` für rein deterministische, mehrseitige, farbige Bauanleitungs-PDFs inkl. 2D/3D-Vektordarstellung bzw. eingebetteter Offscreen-Three.js-PNG-Snapshots und roter Hervorhebung neu gesetzter Teile pro Schritt.

## DEC-003: Design-Referenzen
- **Belegt:** Die beiden vom Nutzer bereitgestellten Bilder wurden als `fred-icon.png` und `ui-vorlage.png` im Projektroot abgelegt und dienen als verbindliche Referenz für App-Icon, Maskottchen und das helle 3-Spalten-Layout.

## DEC-004: Google-AI-Modellkennung & Offline-Adapter
- **Entscheidung:** Standardmodell konfigurierbar auf `gemini-4-argon` via `@google/genai`. Für automatisierte Tests ohne Live-API-Key wird ein klar gekennzeichneter `OfflineGeminiAdapter` verwendet; Live-API-Aufrufe bleiben ohne API-Key `NOT_TESTED` und werden in `BLOCKERS.md` dokumentiert.

## DEC-005: Zero-Key-Zugang via Fred-Cloud-Proxy (Cloudflare Worker) + Google Gemini API
- **Ausdrückliche Nutzerentscheidung (Dennis, 2026-11-24):** Kein Ollama / keine lokalen Großmodelle (Endnutzer haben keine entsprechende GPU-Hardware). Stattdessen unterstützt Fred neben dem eigenen Google Gemini API-Key (`@google/genai`, Free-Tier & Pro) einen zentralen **Fred-Cloud-Proxy** (`cloud-proxy/worker.ts`), sodass Endnutzer ohne eigenes Google AI Studio direkt mit Google Gemini arbeiten können.

## DEC-005: Zero-Key-Zugang via Fred-Cloud-Proxy (Cloudflare Worker) + Google Gemini API
- **Ausdrückliche Nutzerentscheidung (Dennis, 2026-11-24):** Kein Ollama / keine lokalen Großmodelle (Endnutzer haben keine entsprechende GPU-Hardware). Stattdessen unterstützt Fred neben dem eigenen Google Gemini API-Key (`@google/genai`, Free-Tier & Pro) einen zentralen **Fred-Cloud-Proxy** (`cloud-proxy/worker.ts`), sodass Endnutzer ohne eigenes Google AI Studio direkt mit Google Gemini arbeiten können.
