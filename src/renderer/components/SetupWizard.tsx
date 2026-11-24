import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, KeyRound, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  DEFAULT_CLOUD_PROXY_URL,
  DEFAULT_GEMINI_MODEL,
  validateApiKeyFormat,
} from '../../core/ai/geminiClient';
import { GoogleImagePlugin, NANO_BANANA_PRIMARY_MODEL } from '../../core/plugins/googleImagePlugin';
import {
  FreeImageMcpKeys,
  loadFreeImageMcpKeys,
  saveFreeImageMcpKeys,
} from '../../core/plugins/freeImageMcpPlugins';

export interface SetupWizardProps {
  isOpen: boolean;
  storageBackend: string;
  onSaveKey: (apiKey: string, budgetEur: number, model: string) => Promise<void>;
  onSaveFreeImageKeys?: (keys: FreeImageMcpKeys) => void;
  onUseCloudProxy: (proxyUrl: string, accessToken: string, model: string) => void;
  onContinueOffline: (budgetEur: number) => void;
  onClose?: () => void;
}

export function SetupWizard({
  isOpen,
  storageBackend,
  onSaveKey,
  onSaveFreeImageKeys,
  onUseCloudProxy,
  onContinueOffline,
  onClose,
}: SetupWizardProps): React.ReactElement | null {
  const [modeTab, setModeTab] = useState<'cloud_proxy' | 'gemini_api' | 'free_image_mcp'>('cloud_proxy');
  const [apiKey, setApiKey] = useState('');
  const [budgetEur, setBudgetEur] = useState(5);
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);

  const [proxyUrl, setProxyUrl] = useState(DEFAULT_CLOUD_PROXY_URL);
  const [proxyToken, setProxyToken] = useState('');

  const initialFreeKeys = loadFreeImageMcpKeys();
  const [hfToken, setHfToken] = useState(initialFreeKeys.huggingFaceToken ?? '');
  const [cfAccountId, setCfAccountId] = useState(initialFreeKeys.cloudflareAccountId ?? '');
  const [cfApiToken, setCfApiToken] = useState(initialFreeKeys.cloudflareApiToken ?? '');
  const [pollinationsKey, setPollinationsKey] = useState(initialFreeKeys.pollinationsApiKey ?? '');
  const [freeSavedMsg, setFreeSavedMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nanoStatus, setNanoStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingNano, setTestingNano] = useState(false);

  const handleTestNanoBanana = async () => {
    const check = validateApiKeyFormat(apiKey);
    if (!check.valid) {
      setNanoStatus({ ok: false, message: check.reason ?? 'Bitte gültigen Key eingeben.' });
      return;
    }
    setTestingNano(true);
    setNanoStatus(null);
    try {
      const plugin = new GoogleImagePlugin({ apiKey: apiKey.trim(), useOfflineAdapter: false });
      const res = await plugin.testConnection();
      setNanoStatus({ ok: res.ok, message: res.message });
    } finally {
      setTestingNano(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateApiKeyFormat(apiKey);
    if (!check.valid) {
      setError(check.reason ?? 'Ungültiger API-Key');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSaveKey(apiKey.trim(), budgetEur, model.trim() || DEFAULT_GEMINI_MODEL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="setup-wizard-title">
      <div className="modal-card setup-wizard-card">
        <div className="modal-header-row">
          <div className="wizard-header" style={{ marginBottom: 0 }}>
            <img src="./fred-icon.png" alt="Fred" className="wizard-avatar" />
            <div>
              <h2 id="setup-wizard-title">Fred KI-Anbindung (Google Gemini Cloud)</h2>
              <p className="wizard-subtitle">
                Keine lokale GPU nötig – nutze den zentralen Fred-Cloud-Proxy oder deinen eigenen Gemini-Key
              </p>
            </div>
          </div>
          {onClose && (
            <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Schließen">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="detail-selector-row" style={{ margin: '14px 0' }}>
          <button
            type="button"
            className={`chip-btn ${modeTab === 'cloud_proxy' ? 'active' : ''}`}
            onClick={() => {
              setModeTab('cloud_proxy');
              setError(null);
            }}
          >
            <Cloud size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            Fred-Cloud-Proxy (Ohne eigenen API-Key)
          </button>
          <button
            type="button"
            className={`chip-btn ${modeTab === 'gemini_api' ? 'active' : ''}`}
            onClick={() => {
              setModeTab('gemini_api');
              setError(null);
            }}
          >
            <KeyRound size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            Google Gemini & Nano Banana
          </button>
          <button
            type="button"
            className={`chip-btn ${modeTab === 'free_image_mcp' ? 'active' : ''}`}
            onClick={() => {
              setModeTab('free_image_mcp');
              setError(null);
              setFreeSavedMsg(null);
            }}
          >
            <Sparkles size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            Kostenlose Bild-MCP (FLUX)
          </button>
        </div>

        {modeTab === 'free_image_mcp' ? (
          <div className="wizard-form">
            <div className="wizard-steps">
              <h3>Feste MCP-Auswahlreihenfolge für Vorschaubilder</h3>
              <ol>
                <li><strong>Priorität 1:</strong> Google Nano Banana (wenn Gemini-Key + Billing aktiv)</li>
                <li><strong>Priorität 2:</strong> Hugging Face FLUX MCP (<code>FLUX.1-schnell</code> / <code>dev</code>, kostenloses HF-Konto)</li>
                <li><strong>Priorität 3:</strong> Cloudflare Workers AI FLUX MCP (10.000 Neurons/Tag kostenlos)</li>
                <li><strong>Priorität 4:</strong> Pollinations.ai FLUX MCP (kostenloser <code>sk_</code>-Key)</li>
              </ol>
            </div>

            <label className="field-label">
              <span>Priorität 2 – Hugging Face Token (kostenlos auf huggingface.co/settings/tokens)</span>
              <input
                type="password"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                placeholder="hf_..."
                autoComplete="off"
                className="text-input"
              />
            </label>

            <div className="wizard-grid">
              <label className="field-label">
                <span>Priorität 3 – Cloudflare Account ID</span>
                <input
                  type="text"
                  value={cfAccountId}
                  onChange={(e) => setCfAccountId(e.target.value)}
                  placeholder="Optional"
                  className="text-input"
                />
              </label>
              <label className="field-label">
                <span>Priorität 3 – Cloudflare API Token</span>
                <input
                  type="password"
                  value={cfApiToken}
                  onChange={(e) => setCfApiToken(e.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                  className="text-input"
                />
              </label>
            </div>

            <label className="field-label">
              <span>Priorität 4 – Pollinations API-Key (kostenlos auf enter.pollinations.ai)</span>
              <input
                type="password"
                value={pollinationsKey}
                onChange={(e) => setPollinationsKey(e.target.value)}
                placeholder="sk_... (Optional)"
                autoComplete="off"
                className="text-input"
              />
            </label>

            {freeSavedMsg && (
              <p style={{ color: '#15803d', fontWeight: 700, fontSize: '13px', margin: '4px 0' }}>
                {freeSavedMsg}
              </p>
            )}

            <div className="wizard-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onClose?.()}
              >
                Schließen
              </button>
              <button
                type="button"
                className="btn-primary-green"
                onClick={() => {
                  const nextKeys: FreeImageMcpKeys = {
                    huggingFaceToken: hfToken.trim() || undefined,
                    cloudflareAccountId: cfAccountId.trim() || undefined,
                    cloudflareApiToken: cfApiToken.trim() || undefined,
                    pollinationsApiKey: pollinationsKey.trim() || undefined,
                  };
                  saveFreeImageMcpKeys(nextKeys);
                  onSaveFreeImageKeys?.(nextKeys);
                  setFreeSavedMsg('Kostenlose Bild-MCP-Server gespeichert & in Prioritätskette aktiviert!');
                }}
              >
                <CheckCircle2 size={16} /> Kostenlose Bild-MCP aktivieren
              </button>
            </div>
          </div>
        ) : modeTab === 'cloud_proxy' ? (
          <div className="wizard-form">
            <div className="wizard-steps">
              <h3>Sofort startklar für Endnutzer – ohne eigenes Google AI Studio</h3>
              <ol>
                <li>
                  Endnutzer brauchen <strong>keine starke Hardware</strong> und{' '}
                  <strong>keinen eigenen Google-AI-Studio-Schlüssel</strong>.
                </li>
                <li>
                  Alle Anfragen laufen sicher über den zentralen <strong>Fred-Cloud-Proxy</strong>{' '}
                  (Cloudflare Worker, Vorlage liegt in <code>cloud-proxy/worker.ts</code>) direkt an Google Gemini.
                </li>
              </ol>
            </div>

            <label className="field-label">
              <span>Fred-Cloud-Proxy URL</span>
              <input
                type="url"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                className="text-input"
              />
            </label>

            <div className="wizard-grid">
              <label className="field-label">
                <span>Optionales Zugangstoken</span>
                <input
                  type="password"
                  value={proxyToken}
                  onChange={(e) => setProxyToken(e.target.value)}
                  placeholder="Optional"
                  className="text-input"
                />
              </label>
              <label className="field-label">
                <span>Gemini-Modell</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="text-input"
                />
              </label>
            </div>

            <div className="wizard-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onContinueOffline(budgetEur)}
              >
                Offline-Modus
              </button>
              <button
                type="button"
                className="btn-primary-green"
                onClick={() =>
                  onUseCloudProxy(
                    proxyUrl.trim() || DEFAULT_CLOUD_PROXY_URL,
                    proxyToken.trim(),
                    model.trim() || DEFAULT_GEMINI_MODEL,
                  )
                }
              >
                <CheckCircle2 size={16} /> Mit Fred-Cloud-Proxy verbinden
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveCloud} className="wizard-form">
            <div className="cost-warning-box" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Transparente Kosteninfo:</strong> Mit jedem normalen kostenlosen Google-Konto
                kannst du unter <code>aistudio.google.com/apikey</code> einen <strong>kostenlosen Free-Tier-Key</strong>{' '}
                (ohne Abo) erstellen. Erst bei aktivierter Abrechnung entstehen nutzungsabhängige API-Kosten,
                getrennt vom Gemini-Web-Abo. Dein lokaler Budget-Stopp schützt zusätzlich.
              </div>
            </div>

            <label className="field-label">
              <span><KeyRound size={15} /> Google Gemini API-Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
                className="text-input"
              />
            </label>

            <div className="wizard-grid">
              <label className="field-label">
                <span>Standard-Modell</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="text-input"
                />
              </label>
              <label className="field-label">
                <span>Lokaler Budget-Stopp (€)</span>
                <input
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={budgetEur}
                  onChange={(e) => setBudgetEur(Number(e.target.value))}
                  className="text-input"
                />
              </label>
            </div>

            {error && <p className="error-text">{error}</p>}

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #dbe4ef',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '12.5px', color: '#1e293b' }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={14} color="#eab308" /> Festes Bild-Werkzeug: Nano Banana ({NANO_BANANA_PRIMARY_MODEL})
                </strong>
                {nanoStatus && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontWeight: 600,
                      color: nanoStatus.ok ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {nanoStatus.message}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestNanoBanana}
                disabled={testingNano || !apiKey.trim()}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                {testingNano ? 'Prüfe...' : 'Nano Banana testen'}
              </button>
            </div>

            <div className="wizard-security-note">
              <ShieldCheck size={16} />
              <span>Lokale Verschlüsselung über {storageBackend}.</span>
            </div>

            <div className="wizard-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onContinueOffline(budgetEur)}
              >
                Offline-Modus
              </button>
              <button type="submit" className="btn-primary-green" disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? 'Speichere...' : 'Key sicher speichern & starten'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
