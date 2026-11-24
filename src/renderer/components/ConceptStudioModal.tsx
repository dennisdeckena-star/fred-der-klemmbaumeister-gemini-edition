import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  ConceptSession,
  ConceptStudioService,
  DetailLevel,
} from '../../core/concept/conceptStudio';
import { CadModel } from '../../core/cad';

export interface ConceptStudioModalProps {
  isOpen: boolean;
  studio: ConceptStudioService;
  onClose: () => void;
  onModelApprovedAndBuilt: (model: CadModel) => void;
}

export function ConceptStudioModal({
  isOpen,
  studio,
  onClose,
  onModelApprovedAndBuilt,
}: ConceptStudioModalProps): React.ReactElement | null {
  const [title, setTitle] = useState('Mein Schiff-Konzept');
  const [prompt, setPrompt] = useState('Dreimast-Segelschiff mit gelbem Deck, rotem Rumpf und weißen Segeln');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('STANDARD');
  const [changeRequest, setChangeRequest] = useState('');
  const [session, setSession] = useState<ConceptSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const latest = session ? session.revisions[session.revisions.length - 1] : null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const created = await studio.createConcept(title.trim() || 'Neues Konzept', prompt.trim(), detailLevel);
      setSession({ ...created });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konzept-Erzeugung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!session || !changeRequest.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await studio.reviseConcept(session.id, changeRequest.trim(), detailLevel);
      setSession({ ...updated });
      setChangeRequest('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndBuild = () => {
    if (!session) return;
    try {
      studio.approveConcept(session.id, 'Dennis');
      const cadModel = studio.buildDeterministicModelFromApprovedConcept(session.id);
      onModelApprovedAndBuilt(cadModel);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigabe fehlgeschlagen');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Konzeptstudio">
      <div className="modal-card concept-studio-card">
        <div className="modal-header-row">
          <div>
            <h2><Sparkles size={20} /> Konzeptstudio (Bildvorschau & Freigabe-Gate)</h2>
            <p className="wizard-subtitle">
              Erst Konzeptbild verfeinern, dann explizit freigeben – Konzeptbild ≠ 3D-CAD-Modell!
            </p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="concept-controls">
          <input
            type="text"
            className="text-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Modellname (z. B. Titanic, Burg, Weltraum-Rover)"
          />
          <textarea
            className="text-input"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Beschreibe dein Wunschmodell..."
          />
          <div className="detail-selector-row">
            {(['COMPACT', 'STANDARD', 'DISPLAY'] as DetailLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`chip-btn ${detailLevel === lvl ? 'active' : ''}`}
                onClick={() => setDetailLevel(lvl)}
              >
                {lvl === 'COMPACT' ? 'Kompakt' : lvl === 'STANDARD' ? 'Standard' : 'Vitrine (Display)'}
              </button>
            ))}
            <button type="button" className="btn-primary-blue" onClick={handleGenerate} disabled={loading}>
              <Sparkles size={15} /> {loading ? 'Erzeuge...' : 'Konzeptvorschau erzeugen'}
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {latest && (
          <div className="concept-preview-area">
            <div className="concept-image-frame">
              <img src={latest.imageDataUrl} alt={`Konzept Revision ${latest.revision}`} />
              <span className="ai-badge-overlay">
                KI-generiertes Konzeptbild (EU AI Act Art. 50) • Rev. {latest.revision}
              </span>
            </div>

            <div className="recommendations-grid">
              {latest.recommendations.map((rec) => (
                <div
                  key={rec.detailLevel}
                  className={`rec-card ${rec.detailLevel === latest.detailLevel ? 'selected' : ''}`}
                >
                  <strong>{rec.detailLevel} (~{rec.estimatedParts} Teile)</strong>
                  <p>{rec.summary}</p>
                </div>
              ))}
            </div>

            <div className="revision-loop-row">
              <input
                type="text"
                className="text-input"
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                placeholder="Änderungswunsch (z. B. Mehr Details am Heck, weniger Noppen)..."
              />
              <button type="button" className="btn-secondary" onClick={handleRevise} disabled={loading}>
                <RefreshCw size={15} /> Überarbeiten
              </button>
              <button type="button" className="btn-primary-green" onClick={handleApproveAndBuild}>
                <CheckCircle2 size={16} /> Freigeben & 3D-Modell bauen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
