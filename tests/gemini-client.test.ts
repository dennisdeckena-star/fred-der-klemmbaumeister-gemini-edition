import { describe, expect, it } from 'vitest';
import {
  BudgetLimitExceededError,
  DEFAULT_GEMINI_MODEL,
  FredGeminiClient,
  RateLimitExceededError,
  validateApiKeyFormat,
} from '../src/core/ai/geminiClient';

describe('Phase 2.1: Gemini-Client (@google/genai), Fred-Cloud-Proxy, Rate-Limit & Budget-Stopp', () => {
  it('verwendet gemini-4-argon als Standardmodell und streamt im Offline-Adapter-Modus', async () => {
    const client = new FredGeminiClient({ useOfflineAdapter: true });
    const chunks: string[] = [];

    const res = await client.streamChat(
      [{ role: 'user', text: 'Welche Steine brauche ich als nächstes?' }],
      (chunk) => chunks.push(chunk),
    );

    expect(res.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(res.model).toBe('gemini-4-argon');
    expect(res.adapterMode).toBe('OFFLINE_TEST_ADAPTER');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(res.text);
  });

  it('erzwingt Rate-Limit-Schutz pro Minute', async () => {
    const client = new FredGeminiClient({
      useOfflineAdapter: true,
      maxRequestsPerMinute: 2,
    });

    await client.streamChat([{ role: 'user', text: 'Anfrage 1' }]);
    await client.streamChat([{ role: 'user', text: 'Anfrage 2' }]);

    await expect(
      client.streamChat([{ role: 'user', text: 'Anfrage 3' }]),
    ).rejects.toThrow(RateLimitExceededError);
  });

  it('löst konfigurierbaren Budget-Stopp aus, bevor das Limit überschritten wird', async () => {
    const client = new FredGeminiClient({
      useOfflineAdapter: true,
      maxBudgetEur: 0.0001,
      estimatedEurPer1kTokens: 1.0,
    });

    await expect(
      client.streamChat([{ role: 'user', text: 'Bitte baue ein riesiges Schiff mit vielen Steinen.' }]),
    ).rejects.toThrow(BudgetLimitExceededError);
  });

  it('validiert API-Key-Eingaben sauber', () => {
    expect(validateApiKeyFormat('').valid).toBe(false);
    expect(validateApiKeyFormat('kurz').valid).toBe(false);
    expect(validateApiKeyFormat('AIzaSy Beispiel Mit Leerzeichen 123456').valid).toBe(false);
    expect(validateApiKeyFormat('AIzaSyD-TestKey-1234567890abcdefghij').valid).toBe(true);
  });

  it('verbindet sich ohne lokalen API-Key über den Fred-Cloud-Proxy (Cloudflare Worker)', async () => {
    const mockFetch = (async () =>
      new Response(JSON.stringify({ text: 'Proxy-Antwort von Gemini!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    const client = new FredGeminiClient({
      providerMode: 'FRED_CLOUD_PROXY',
      proxyUrl: 'https://fred-proxy.example/api/chat',
    });

    const chunks: string[] = [];
    const res = await client.streamChat(
      [{ role: 'user', text: 'Hallo Proxy' }],
      (ch) => chunks.push(ch),
      mockFetch,
    );

    expect(res.adapterMode).toBe('FRED_CLOUD_PROXY');
    expect(res.text).toBe('Proxy-Antwort von Gemini!');
    expect(chunks.join('')).toBe('Proxy-Antwort von Gemini!');
  });
});
