import React from 'react';
import { FileDown, Heart, Star } from 'lucide-react';
import { CadModel } from '../../core/cad';

export interface SavedPdfMeta {
  modelId: string;
  fileName: string;
  pageCount: number;
  sha256: string;
  createdAt: string;
  objectUrl?: string;
}

export interface BlueprintSidebarProps {
  models: CadModel[];
  activeModelId: string;
  favorites: Record<string, boolean>;
  savedPdfs: Record<string, SavedPdfMeta>;
  onSelectModel: (modelId: string) => void;
  onToggleFavorite: (modelId: string) => void;
  onDownloadSavedPdf: (modelId: string) => void;
}

function BlueprintThumbnail({ icon }: { icon: string }): React.ReactElement {
  switch (icon) {
    case 'castle':
      return (
        <svg viewBox="0 0 120 90" className="blueprint-svg">
          <rect x="22" y="42" width="76" height="36" rx="3" fill="#b4bcc6" stroke="#475569" strokeWidth="2" />
          <rect x="18" y="24" width="22" height="54" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          <rect x="80" y="24" width="22" height="54" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          <rect x="46" y="18" width="28" height="60" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
          <polygon points="18,24 29,10 40,24" fill="#ef4444" />
          <polygon points="80,24 91,10 102,24" fill="#3b82f6" />
          <polygon points="46,18 60,4 74,18" fill="#f59e0b" />
          <rect x="52" y="54" width="16" height="24" rx="6" fill="#7c2d12" />
        </svg>
      );
    case 'rover':
      return (
        <svg viewBox="0 0 120 90" className="blueprint-svg">
          <rect x="28" y="44" width="64" height="22" rx="4" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
          <rect x="34" y="34" width="44" height="14" rx="3" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
          <rect x="42" y="14" width="8" height="22" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
          <rect x="36" y="10" width="20" height="12" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
          <circle cx="38" cy="70" r="10" fill="#334155" />
          <circle cx="60" cy="70" r="10" fill="#334155" />
          <circle cx="82" cy="70" r="10" fill="#334155" />
        </svg>
      );
    case 'plane':
      return (
        <svg viewBox="0 0 120 90" className="blueprint-svg">
          <polygon points="18,52 96,38 102,48 24,62" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
          <polygon points="44,44 72,22 82,26 56,50" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="2" />
          <polygon points="48,54 74,76 84,70 60,50" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="2" />
          <polygon points="88,40 100,22 106,24 98,42" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
        </svg>
      );
    case 'ship':
      return (
        <svg viewBox="0 0 120 90" className="blueprint-svg">
          <polygon points="20,56 100,56 88,76 32,76" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
          <rect x="24" y="46" width="72" height="12" rx="3" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          <rect x="42" y="16" width="5" height="32" fill="#78350f" />
          <rect x="66" y="12" width="5" height="36" fill="#78350f" />
          <rect x="34" y="20" width="22" height="18" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          <rect x="58" y="16" width="22" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          <polygon points="66,12 80,8 80,15" fill="#dc2626" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 90" className="blueprint-svg">
          <rect x="22" y="46" width="76" height="24" rx="4" fill="#e11d48" stroke="#881337" strokeWidth="2" />
          <rect x="30" y="28" width="60" height="20" rx="4" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          <rect x="42" y="16" width="36" height="14" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
        </svg>
      );
  }
}

export function BlueprintSidebar({
  models,
  activeModelId,
  favorites,
  savedPdfs,
  onSelectModel,
  onToggleFavorite,
  onDownloadSavedPdf,
}: BlueprintSidebarProps): React.ReactElement {
  return (
    <aside className="blueprint-sidebar" aria-label="Meine Baupläne">
      <h2 className="sidebar-title">MEINE BAUPLÄNE</h2>
      <div className="blueprint-list">
        {models.map((m) => {
          const isActive = m.id === activeModelId;
          const isFav = Boolean(favorites[m.id]);
          const icon = typeof m.metadata?.icon === 'string' ? m.metadata.icon : 'module';
          return (
            <div
              key={m.id}
              className={`blueprint-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectModel(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectModel(m.id);
                }
              }}
            >
              <div className="blueprint-card-top">
                <Star size={16} className="star-icon" fill="#facc15" color="#eab308" />
                <button
                  type="button"
                  className="fav-btn"
                  aria-label={`${m.name} als Favorit umschalten`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(m.id);
                  }}
                >
                  <Heart
                    size={16}
                    fill={isFav ? '#ef4444' : '#cbd5e1'}
                    color={isFav ? '#ef4444' : '#94a3b8'}
                  />
                </button>
              </div>
              {typeof m.metadata?.thumbnailUrl === 'string' && m.metadata.thumbnailUrl ? (
                <img
                  src={m.metadata.thumbnailUrl}
                  alt={m.name}
                  className="blueprint-svg"
                  style={{ objectFit: 'cover', borderRadius: '10px', height: '78px', width: '100%' }}
                />
              ) : (
                <BlueprintThumbnail icon={icon} />
              )}
              <div className="blueprint-name">{m.name}</div>
              <div className="blueprint-meta">{m.parts.length} Teile</div>
              {savedPdfs[m.id] && (
                <button
                  type="button"
                  className="blueprint-pdf-badge"
                  title={`Gespeicherte PDF-Anleitung herunterladen (${savedPdfs[m.id].pageCount} Seiten)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadSavedPdf(m.id);
                  }}
                >
                  <FileDown size={12} /> PDF ({savedPdfs[m.id].pageCount} S.)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
