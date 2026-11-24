import React from 'react';
import { Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { SubjectResearchBrief } from '../../core/ai/geminiClient';

export interface ConceptApprovalModalProps {
  isOpen: boolean;
  brief: SubjectResearchBrief | null;
  imageUrl?: string;
  imageBadge?: string;
  imageErrorNote?: string;
  onApprove: () => void;
  onReject: () => void;
}

export function ConceptApprovalModal({
  isOpen,
  brief,
  imageUrl,
  imageBadge,
  imageErrorNote,
  onApprove,
  onReject,
}: ConceptApprovalModalProps): React.ReactElement | null {
  if (!isOpen || !brief) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Vorschaubild bewerten"
      style={{ zIndex: 120 }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '720px',
          width: '92vw',
          padding: '22px 24px',
          borderRadius: '20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
            <Sparkles size={20} color="#2563eb" />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Gefällt dir diese Klemmbaustein-Vorschau?
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#475569' }}>
                {brief.title} ({brief.scaleLabel}) • {brief.realDimensionsNote}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReject}
            aria-label="Schließen und anpassen"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            background: '#eef2f6',
            borderRadius: '16px',
            padding: '12px',
            marginBottom: '16px',
            border: '1px solid #dbe4ef',
          }}
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={`Fotorealistische Klemmbaustein-Vorschau: ${brief.title}`}
                style={{
                  width: '100%',
                  maxHeight: '380px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
              {imageBadge && (
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
                  {imageBadge}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '28px 16px', color: '#334155', fontSize: '13.5px' }}>
              <strong>Konzept-Briefing bereit ({brief.title})</strong>
              <p style={{ margin: '8px 0 0', color: '#64748b' }}>
                {imageErrorNote
                  ? `Hinweis zur Live-Bilderzeugung: ${imageErrorNote}`
                  : 'Ohne aktive Google-Bild-API startet Fred direkt nach deiner Freigabe den 3D-Bauplan.'}
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '14px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onApprove}
            data-testid="approve-concept-btn"
            style={{
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              borderRadius: '14px',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(22, 163, 74, 0.28)',
            }}
          >
            <ThumbsUp size={22} />
            <span>Ja, gefällt mir — Bauplan erstellen!</span>
          </button>

          <button
            type="button"
            onClick={onReject}
            data-testid="reject-concept-btn"
            style={{
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              borderRadius: '14px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(220, 38, 38, 0.24)',
            }}
          >
            <ThumbsDown size={22} />
            <span>Nein, bitte im Chat anpassen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
