/**
 * Fred Cloud Proxy (Cloudflare Worker) – Zero-Key-Zugang für Endnutzer.
 * Unterstützt:
 * - mode: "chat"     (normale Konversation)
 * - mode: "research" (Google Search Grounding + optionales Referenzbild)
 * - mode: "vision"   (Multimodal-Bildvergleich: Konzeptbild vs. 3D-Renderings)
 * Der Betreiber hinterlegt einmalig `GEMINI_API_KEY` als Cloudflare-Secret.
 */
export interface Env {
  GEMINI_API_KEY: string;
  FRED_PROXY_TOKEN?: string;
}

interface InlineImagePart {
  mimeType: string;
  data: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    if (env.FRED_PROXY_TOKEN) {
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${env.FRED_PROXY_TOKEN}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const body = (await request.json()) as {
      mode?: 'chat' | 'research' | 'vision';
      model?: string;
      messages?: Array<{ role: string; text: string }>;
      inlineImages?: InlineImagePart[];
    };

    const mode = body.mode ?? 'chat';
    const model = body.model || 'gemini-4-argon';
    const systemText = (body.messages ?? []).find((m) => m.role === 'system')?.text;
    const inlineImages = Array.isArray(body.inlineImages) ? body.inlineImages : [];

    const nonSystem = (body.messages ?? []).filter((m) => m.role !== 'system');
    const contents = nonSystem.map((m, idx) => {
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
        { text: m.text },
      ];
      if (idx === nonSystem.length - 1 && inlineImages.length > 0) {
        for (const img of inlineImages) {
          parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
        }
      }
      return {
        role: m.role === 'model' ? 'model' : 'user',
        parts,
      };
    });

    const payload: Record<string, unknown> = {
      contents,
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      ...(mode === 'research' ? { tools: [{ google_search: {} }] } : {}),
    };

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!apiRes.ok) {
      return new Response(JSON.stringify({ error: `Gemini HTTP ${apiRes.status}` }), {
        status: apiRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = (await apiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const sources =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c) => Boolean(c.web?.uri))
        .map((c) => ({ title: c.web?.title ?? c.web?.uri ?? '', url: c.web?.uri ?? '' })) ?? [];

    return new Response(JSON.stringify({ text, model, mode, sources }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
