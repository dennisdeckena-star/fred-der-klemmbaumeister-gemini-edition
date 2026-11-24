# Datenschutzerklärung (DSGVO / GDPR)

**Software:** Fred, der Klemmbaumeister – Gemini Edition (Desktop-Anwendung für Windows 11 x64)  
**Stand:** 2026-11-24

## 1. Grundsatz der Datenminimierung (Art. 5 DSGVO)
„Fred, der Klemmbaumeister – Gemini Edition“ ist nach dem Prinzip **Local-First** entwickelt:
- Alle 3D-Baupläne (`.fred.json`, `.ldr`), Baufortschritte, Favoriten, lokale Wissensdatenbanken (SQLite FTS5) sowie `Memory.md` verbleiben **ausschließlich lokal** auf Ihrem Gerät.
- Die Anwendung enthält **keine Telemetrie**, **kein Tracking**, **keine Werbe-SDKs** und übermittelt im Offline-Modus keinerlei personenbezogene Daten an Dritte.

## 2. Optionale KI-Dienste (Google Gemini / Fred Cloud Proxy)
Die Nutzung von Cloud-KI-Funktionen (Chat-Antworten, Internet-Recherche via Google Search Grounding, Konzeptbild-Erzeugung via Google Imagen und visuelle 3D-Selbstprüfung via Gemini Vision) ist **freiwillig (Opt-in)** und erfordert Ihre aktive Konfiguration unter **„API-Setup“**:
- **Direkte Google-Gemini-API:** Bei Hinterlegung Ihres eigenen Google-AI-Studio-API-Keys werden Chat-Eingaben und ggf. von Ihnen hochgeladene Referenzbilder direkt verschlüsselt (HTTPS) an die API von **Google LLC** (`generativelanguage.googleapis.com`) übermittelt. Es gelten die Datenschutzbestimmungen und API-Nutzungsbedingungen von Google.
- **Optionaler Fred Cloud Proxy:** Falls Sie einen eigenen Cloudflare-Worker-Proxy (`cloud-proxy/worker.ts`) betreiben und verbinden, werden Anfragen über diesen Proxy an die Google Gemini API weitergeleitet.
- **API-Key-Schutz (Art. 32 DSGVO):** Ihr API-Key wird niemals im Klartext in Projektdateien gespeichert, sondern unter Windows über den **Windows Credential Manager / Electron `safeStorage` (DPAPI)** verschlüsselt abgelegt.

## 3. Rechte betroffener Personen (DSGVO Art. 15–20)
Direkt in der Anwendung unter **„Prüfen & Wissen“ → „EU AI Act & DSGVO“** stehen Ihnen jederzeit folgende Funktionen zur Verfügung:
- **Datenübertragbarkeit (Art. 20 DSGVO):** Vollständiger Export aller lokalen Nutzerdaten als maschinenlesbares JSON (`fred-lokale-daten-export.json`) sowie LDraw-`.ldr`-Export.
- **Recht auf Löschung (Art. 17 DSGVO):** Vollständige, unwiderrufliche Löschung aller lokal gespeicherten Fortschrittsdaten, Favoriten, Wissensindizes und des gespeicherten API-Keys auf Knopfdruck.

## 4. Hinweis zur Verantwortung bei eigenem Betrieb
Wenn Sie diese Software selbst kompilieren, betreiben oder über einen eigenen Cloud-Proxy Dritten bereitstellen, sind Sie für die Einhaltung der jeweiligen datenschutzrechtlichen Informationspflichten (inkl. Impressum und Verantwortlichen-Angaben) selbst verantwortlich.
