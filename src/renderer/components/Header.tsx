import React from 'react';
import { FileDown, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';

export interface HeaderProps {
  onExportPdf: () => void;
  exportingPdf: boolean;
  onOpenConceptStudio: () => void;
  onOpenInspector: () => void;
  onOpenSetupWizard: () => void;
}

export function Header({
  onExportPdf,
  exportingPdf,
  onOpenConceptStudio,
  onOpenInspector,
  onOpenSetupWizard,
}: HeaderProps): React.ReactElement {
  return (
    <header className="fred-header">
      <div className="fred-brand">
        <img src="./fred-icon.png" alt="Fred, der Klemmbaumeister" className="fred-avatar" />
        <div className="fred-balloon-logo" aria-label="FRED - GEMINI EDITION">
          <span className="logo-sparkle">✦</span>
          <span className="logo-word logo-green">FRED</span>
          <span className="logo-dash">-</span>
          <span className="logo-word logo-yellow">GEMINI</span>
          <span className="logo-word-joined">
            <span className="logo-word logo-blue">EDIT</span>
            <span className="logo-word logo-red">ION</span>
          </span>
          <span className="logo-sparkle logo-sparkle-pink">✦</span>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#475569',
            background: '#e2e8f0',
            borderRadius: '999px',
            padding: '2px 8px',
            marginLeft: '4px',
          }}
          title="Installierte Software-Version"
        >
          v1.4.0
        </span>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="header-pill-btn"
          onClick={onOpenConceptStudio}
          title="Neues Konzeptbild erzeugen & freigeben"
        >
          <Sparkles size={15} /> Konzeptstudio
        </button>
        <button
          type="button"
          className="header-pill-btn"
          onClick={onOpenInspector}
          title="Validierung, Stückliste, Wissen (RAG), Memory & Datenschutz"
        >
          <ShieldCheck size={15} /> Prüfen & Wissen
        </button>
        <button
          type="button"
          className="header-pill-btn"
          onClick={onOpenSetupWizard}
          title="Google Gemini API-Key & Budget konfigurieren"
        >
          <KeyRound size={15} /> API-Setup
        </button>
        <button
          type="button"
          className="pdf-export-btn"
          onClick={onExportPdf}
          disabled={exportingPdf}
        >
          <FileDown size={17} /> {exportingPdf ? 'EXPORTIERE...' : 'PDF EXPORT'}
        </button>
      </div>
    </header>
  );
}
