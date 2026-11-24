# Fred, der Klemmbaumeister – Gemini Edition

**Lokale 3D-Klemmbaustein-CAD- & Bauanleitungs-Desktopsoftware für Windows 11 x64** — entwickelt für erwachsene Klemmbaustein-Sammler (AFOLs / MOC-Ingenieure), mit Google Gemini Integration, 20-LDU-Physikprüfung und BlueBrixx-ergonomischen PDF-Bauanleitungen.

---

## Kernfunktionen

- **6-Stufen-Fred-Pro-Pipeline:**
  1. **Internet- & Referenz-Research** über Google Gemini + Google Search Grounding (reale Maße, Proportionen, Farben)
  2. **Fotorealistische Konzeptvorschau** (Google Imagen 3 oder eigener Referenzbild-Upload direkt im Chat)
  3. **Profi-Makro-CAD-Engine** im echten versetzten Steinverbund (`1×8`/`1×4`/`1×3`/`1×2`, Technic-Innenkiel, Display-Ständer, Slopes, Fliesen)
  4. **Deterministisches 20-LDU-Physik-Gate** (0 Kollisionen, 100 % Noppenraster, Verbundenheitsprüfung)
  5. **Visuelle Selbstkritik (Vision-Loop):** 3D-Multi-Angle-Renderings werden gegen das Zielbild geprüft
  6. **BlueBrixx-ergonomische Bauschritte** (max. 14 Teile & max. 6 Teiletypen pro Schritt) + A4-Querformat-PDF
- **Interaktive 3D-Bühne (Three.js + LDraw):** Studio-Beleuchtung, Explosionsansicht, Baugruppen-Isolation, Schritt-für-Schritt-Markierung.
- **Multi-Marken-Katalog & Stückliste:** Mapping für LEGO, GoBricks/Pantasy, Xingbao, BlueBrixx, CaDA und COBI inkl. Webrick-/GoBricks-CSV-Export.
- **Datenschutz & Sicherheit (Local-First):** Alle Projekte, SQLite-RAG-Indizes und Fortschritte bleiben lokal; API-Key geschützt im Windows Credential Manager (`safeStorage`).

---

## Schnellstart (Entwicklung & Build)

```bash
npm install
npm run build
npm test
npm run start
```

### Windows 11 x64 Installer bauen
- **Auf Windows 11 lokal:** `npm run dist:win`
- **Automatisch über GitHub Actions:** Bei jedem Release-Tag (`v1.0.0`) oder über den Tab **Actions → Build & Release Windows 11 x64 Installer** wird der native Windows-11-NSIS-Installer inklusive `SHA256SUMS.txt` automatisch gebaut und als GitHub Release veröffentlicht.

---

## Rechtliche Dokumente & Compliance
- [Lizenz (MIT)](./LICENSE)
- [Datenschutzerklärung (DSGVO)](./DATENSCHUTZ.md)
- [Rechtliche Hinweise, Marken-Disclaimer & EU AI Act Art. 50](./LEGAL_NOTICE.md)
- [Compliance-Matrix (EU AI Act & DSGVO)](./COMPLIANCE_MATRIX.md)
- [Sicherheitsrichtlinie](./SECURITY.md)
