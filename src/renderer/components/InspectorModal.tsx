import React, { useMemo, useState } from 'react';
import { Download, ShieldCheck, Trash2, X } from 'lucide-react';
import { CadModel } from '../../core/cad';
import { BomReport, InstructionStep } from '../../core/pdf/pdfExporter';
import { runValidationCenter } from '../../core/validation/validationCenter';

export interface InspectorModalProps {
  isOpen: boolean;
  model: CadModel;
  bom: BomReport;
  steps: InstructionStep[];
  currentStep: number;
  onJumpToStep: (step: number) => void;
  onExportUserData: () => void;
  onDeleteAllUserData: () => void;
  onClose: () => void;
}

export function InspectorModal({
  isOpen,
  model,
  bom,
  steps,
  currentStep,
  onJumpToStep,
  onExportUserData,
  onDeleteAllUserData,
  onClose,
}: InspectorModalProps): React.ReactElement | null {
  const [tab, setTab] = useState<'validation' | 'bom' | 'steps' | 'compliance'>('validation');
  const validation = useMemo(() => runValidationCenter(model), [model]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Prüfzentrum & Compliance">
      <div className="modal-card inspector-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h2><ShieldCheck size={20} /> Prüfzentrum, Stückliste & Datenschutz – {model.name}</h2>
            <p className="wizard-subtitle">
              Deterministische Validierung: <strong>{validation.deterministicStatus}</strong> • Teile: {bom.totalParts} • Schritte: {steps.length}
            </p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="detail-selector-row" style={{ marginBottom: 14 }}>
          <button type="button" className={`chip-btn ${tab === 'validation' ? 'active' : ''}`} onClick={() => setTab('validation')}>
            Validierungszentrum
          </button>
          <button type="button" className={`chip-btn ${tab === 'bom' ? 'active' : ''}`} onClick={() => setTab('bom')}>
            Stückliste (BOM)
          </button>
          <button type="button" className={`chip-btn ${tab === 'steps' ? 'active' : ''}`} onClick={() => setTab('steps')}>
            Bauschritte ({steps.length})
          </button>
          <button type="button" className={`chip-btn ${tab === 'compliance' ? 'active' : ''}`} onClick={() => setTab('compliance')}>
            EU AI Act & DSGVO
          </button>
        </div>

        {tab === 'validation' && (
          <div className="bom-table-wrap">
            <table className="bom-table">
              <thead>
                <tr>
                  <th>Prüfpunkt</th>
                  <th>Status</th>
                  <th>Nachweis / Details</th>
                </tr>
              </thead>
              <tbody>
                {validation.checks.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.title}</strong></td>
                    <td>
                      <span
                        className="chip-btn"
                        style={{
                          background:
                            c.status === 'PASS' ? '#dcfce7' : c.status === 'FAIL' ? '#fee2e2' : '#fef3c7',
                          color:
                            c.status === 'PASS' ? '#166534' : c.status === 'FAIL' ? '#991b1b' : '#92400e',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>{c.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'bom' && (
          <div className="bom-table-wrap">
            <table className="bom-table">
              <thead>
                <tr>
                  <th>Farbe</th>
                  <th>Menge</th>
                  <th>LDraw-ID</th>
                  <th>Bezeichnung</th>
                  <th>Bestellstatus</th>
                </tr>
              </thead>
              <tbody>
                {bom.items.map((item) => (
                  <tr key={`${item.partId}-${item.colorCode}`}>
                    <td>
                      <span className="color-dot" style={{ backgroundColor: item.colorHex }} />
                      {item.colorName}
                    </td>
                    <td>{item.quantity}x</td>
                    <td><code>{item.partId}</code></td>
                    <td>{item.name}</td>
                    <td>{item.statusFlags.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'steps' && (
          <div className="bom-table-wrap">
            <table className="bom-table">
              <thead>
                <tr>
                  <th>Schritt</th>
                  <th>Baugruppe</th>
                  <th>Neue Teile</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.stepNumber}>
                    <td><strong>Schritt {s.stepNumber}</strong></td>
                    <td>{s.assemblyName}</td>
                    <td>
                      {s.calloutParts.map((p) => `${p.quantity}x ${p.colorName} ${p.name}`).join(', ')}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`chip-btn ${s.stepNumber === currentStep ? 'active' : ''}`}
                        onClick={() => {
                          onJumpToStep(s.stepNumber);
                          onClose();
                        }}
                      >
                        Anzeigen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'compliance' && (
          <div className="wizard-steps">
            <h3>EU AI Act (Art. 50) & DSGVO – Lokale Datenhoheit</h3>
            <ol>
              <li>
                <strong>KI-Kennzeichnung (EU AI Act Art. 50 Abs. 1):</strong> Fred ist im Chat dauerhaft als
                KI-Assistent gekennzeichnet (inkl. Modus-Anzeige Live Google Gemini vs. Offline-Testadapter).
              </li>
              <li>
                <strong>Synthetische Konzeptbilder (EU AI Act Art. 50 Abs. 2):</strong> Alle im Konzeptstudio
                erzeugten Bilder tragen ein sichtbares Kennzeichen sowie maschinenlesbare Metadaten
                (<code>ai_generated: true</code>) und den Hinweis <em>Konzeptbild ≠ 3D-CAD-Modell</em>.
              </li>
              <li>
                <strong>DSGVO (Art. 17 & Art. 20):</strong> Alle Baupläne, Fortschritte, RAG-Dokumente und
                <code>Memory.md</code> liegen ausschließlich lokal auf deinem Gerät. Du kannst alle lokalen
                Nutzerdaten jederzeit exportieren oder vollständig löschen.
              </li>
            </ol>
            <div className="wizard-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn-primary-blue" onClick={onExportUserData}>
                <Download size={15} /> Lokale Daten exportieren (JSON)
              </button>
              <button type="button" className="btn-secondary" onClick={onDeleteAllUserData}>
                <Trash2 size={15} /> Lokale Daten & API-Key löschen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
