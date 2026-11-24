# BMAD / PIV / Ralph-Loop Architektur- & Reparaturplan (v1.0.3)

## 1. Analyse der Ursachen (Belegt)
1. **Abgeschaltete Google-Bildmodelle:** `imagen-3.0-generate-002`, `imagen-4.0-generate-001` (`generateImages`) und `gemini-2.0-flash-exp-image-generation` wurden von Google abgeschaltet (`404 NOT_FOUND`). Laut aktueller offizieller Google-Gemini-API-Dokumentation nutzt die Bilderzeugung heute `ai.models.generateContent` mit `responseModalities: ['TEXT', 'IMAGE']` auf den nativen Gemini-/Nano-Banana-Modellen (`gemini-3.1-flash-image`, `gemini-nano-banana-2.1`, `gemini-3-pro-image`, `gemini-3.1-flash-lite-image`) plus dynamischer `ListModels`-Erkennung.
2. **Fehlende Agenten-Schichten (Harness):** Research, Google-Bild-Plugin, Bauteilkatalog, Makro-CAD-Tools, Physik-Gate und Vision-Selbstkritik waren nicht über einen zentralen, zustandsbasierten Harness mit Werkzeug-Protokoll (`AgentTraceStep`) gekapselt.
3. **Verwechslung von Versionen:** Auf dem Desktop lief noch `v1.0.1`, weil kein sichtbares Versions-Badge im Header angezeigt wurde und die lokale `~/.local`-Kopie nicht bereinigt war.
4. **Teilezahl-Wunsch ignoriert:** Bei „4000 Teile“ wurde noch ein harter String „3.000 Ziel-Skala“ erzeugt.

## 2. Ziel-Schichtenarchitektur (5 Schichten)
| Schicht | Modul | Verantwortung |
|---|---|---|
| **Schicht 1: Wissen & Katalog** | `catalog.ts`, `brandCatalog.ts`, `snot_engineering_rules.ts` | Offizielle LDraw-/Marken-Teile, Farben, Technic-/SNOT-Regeln |
| **Schicht 2: Research** | `geminiClient.ts` (`researchSubject`) | Google Search Grounding: Originalmaße, Maßstab, Merkmale, Quellen |
| **Schicht 3: Google-Bild-Plugin** | `src/core/plugins/googleImagePlugin.ts` | `ListModels`-Autodiscovery + `gemini-3.1-flash-image` / `gemini-nano-banana-2.1` + Multi-Turn-Bildedit bei 👎 |
| **Schicht 4: Agent-Harness & Gate** | `src/core/agent/fredHarness.ts` | Zustandsmaschine (`RESEARCHING → GENERATING_PREVIEW → AWAITING_USER_APPROVAL → BUILDING_CAD → VALIDATING → READY`), striktes 👍/👎-Gate |
| **Schicht 5: CAD & Ralph-Loop QA** | `macroBuilder.ts`, `validationCenter.ts`, `offscreenSnapshotRenderer.ts` | 20-LDU-Steinverbund, 0 Kollisionen, Multi-Angle-Vision-Selbstkritik, BlueBrixx-Schritte & PDF |

## 3. PIV & Ralph-Loop Abnahmekriterien
- **Plan:** Dieser Plan (`BMAD_PIV_HARNESS_PLAN.md`).
- **Implement:** Alle 5 Schichten sauber getrennt, `ConceptStudioService` nutzt `GoogleImagePlugin`, `App.tsx` nutzt `FredAgentHarness`, Header zeigt `v1.0.3`.
- **Verify (Ralph-Loop):**
  1. `npm run build && npm test` (100 % grün, inkl. neuer Harness- & GoogleImagePlugin-Tests).
  2. Live-Playwright-Test:
     - Bauwunsch → Popup öffnet sich **ohne** vorherigen Bauplan.
     - 👎 Roter Daumen → Popup schließt sich → Verfeinerung → neues Popup.
     - 👍 Grüner Daumen → erst jetzt wird der 3D-Bauplan erstellt, im Viewport angezeigt und in `MEINE BAUPLÄNE` gespeichert.
     - 0 Konsolenfehler, keine überlappenden Sprechblasen, `v1.0.3` im Header sichtbar.
  3. Release `v1.0.3` (Windows 11 `.exe` + Ubuntu `.deb`/`.AppImage`) über GitHub Actions + lokal gebaut.
