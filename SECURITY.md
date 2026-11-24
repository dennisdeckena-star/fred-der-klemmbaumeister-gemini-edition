# Sicherheitsrichtlinie (Security Policy)

## Sicherheitsarchitektur
- **API-Key-Speicherung:** Unter Windows über Electron `safeStorage` (Windows DPAPI / Credential Manager) verschlüsselt — niemals im Klartext in Konfigurations- oder Projektdateien.
- **Electron-Härtung:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` im Renderer-Prozess.
- **MCP-Tool-Isolation:** Allowlist-basierter MCP-Broker ohne freien Shell-Zugriff aus KI-Antworten.
- **Prompt-Injection-Schutz:** Eingebettete Steueranweisungen aus Dokumenten/PDFs werden im lokalen RAG-Store gefiltert.

## Schwachstellen melden
Bitte melden Sie Sicherheitslücken nicht über öffentliche Issues, sondern über **GitHub Security Advisories** im Repository. Keine echten API-Keys oder Zugangsdaten in Bug-Reports anhängen!
