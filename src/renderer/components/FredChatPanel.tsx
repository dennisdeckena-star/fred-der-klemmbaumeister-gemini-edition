import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';

export interface UiChatMessage {
  id: string;
  sender: 'fred' | 'user';
  text: string;
  imageUrl?: string;
  imageBadge?: string;
}

export interface FredChatPanelProps {
  messages: UiChatMessage[];
  adapterLabel: string;
  sending: boolean;
  onSendMessage: (text: string, referenceImageDataUrl?: string) => Promise<void>;
}

export function FredChatPanel({
  messages,
  adapterLabel,
  sending,
  onSendMessage,
}: FredChatPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !attachedImage) || sending) return;
    const promptToSend = trimmed || 'Bitte bau mir dieses Modell aus dem Referenzbild nach!';
    const imgToSend = attachedImage;
    setInput('');
    setAttachedImage(undefined);
    await onSendMessage(promptToSend, imgToSend);
  };

  return (
    <aside className="fred-chat-panel" aria-label="Fred's Hilfe Chat">
      <div className="chat-header">
        <h2 className="chat-title">FRED&apos;S HILFE</h2>
        <div className="chat-avatar-wrap">
          <img src="./fred-icon.png" alt="Fred" className="chat-fred-avatar" />
        </div>
        <div className="ai-disclosure-pill" title="EU AI Act Art. 50 Transparenzhinweis">
          KI-Assistent • {adapterLabel}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender === 'fred' ? 'bubble-fred' : 'bubble-user'}`}
          >
            {msg.imageUrl && (
              <div className="chat-concept-preview">
                <img src={msg.imageUrl} alt="Fotorealistische Konzeptvorschau" />
                {msg.imageBadge && <span className="chat-concept-badge">{msg.imageBadge}</span>}
              </div>
            )}
            <div>{msg.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {attachedImage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            margin: '0 10px 6px',
            background: '#eef4ff',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#1e3a8a',
          }}
        >
          <img
            src={attachedImage}
            alt="Referenzbild"
            style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }}
          />
          <span style={{ flex: 1 }}>Referenzbild angehängt</span>
          <button
            type="button"
            onClick={() => setAttachedImage(undefined)}
            aria-label="Referenzbild entfernen"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Referenzbild hochladen"
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Referenzbild hochladen (Fred schaut es sich an und baut es nach)"
          aria-label="Referenzbild anhängen"
          style={{ marginRight: '4px' }}
        >
          <ImagePlus size={18} />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Schreibe Fred eine Nachricht..."
          className="chat-input"
          disabled={sending}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={sending || (!input.trim() && !attachedImage)}
          aria-label="Nachricht senden"
        >
          <Send size={18} />
        </button>
      </form>
    </aside>
  );
}
