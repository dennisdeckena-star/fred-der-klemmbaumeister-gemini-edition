import { DatabaseSync } from 'node:sqlite';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

const EMBEDDING_DIM = 128;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /vergiss\s+(alle\s+)?(vorherigen\s+)?(regeln|anweisungen)/gi,
  /reveal\s+(the\s+)?(system\s+prompt|api[\s_-]?key|secret)/gi,
  /execute\s+(shell|bash|cmd|powershell)/gi,
  /rm\s+-rf\s+\//gi,
  /override\s+security\s+rules/gi,
];

export interface InjectionScanResult {
  sanitizedText: string;
  detected: boolean;
  matchedPatterns: string[];
}

export function scanAndSanitizePromptInjection(text: string): InjectionScanResult {
  let sanitized = text;
  const matchedPatterns: string[] = [];

  for (const rx of INJECTION_PATTERNS) {
    rx.lastIndex = 0;
    if (rx.test(sanitized)) {
      matchedPatterns.push(rx.source);
      rx.lastIndex = 0;
      sanitized = sanitized.replace(rx, '[ENTFERNTE_EINGEBETTETE_ANWEISUNG]');
    }
  }

  return {
    sanitizedText: sanitized,
    detected: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

/**
 * Deterministic local embedding (128-dim L2-normalized token + character trigram projection).
 */
export function computeLocalEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return Array.from(vec);

  const hashIndex = (token: string): number => {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % EMBEDDING_DIM;
  };

  const words = normalized.split(' ');
  for (const w of words) {
    if (w.length < 2) continue;
    vec[hashIndex(`w:${w}`)] += 2.0;
    for (let i = 0; i <= w.length - 3; i++) {
      vec[hashIndex(`g:${w.slice(i, i + 3)}`)] += 1.0;
    }
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => Number((v / norm).toFixed(6)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

export interface RagCitation {
  chunkId: number;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  excerpt: string;
  score: number;
}

export interface RagQueryResult {
  status: 'CONFIRMED_WITH_SOURCE' | 'UNCONFIRMED_NO_SOURCE';
  verified: boolean;
  query: string;
  citations: RagCitation[];
  injectionBlockedCount: number;
}

export interface IngestResult {
  documentId: string;
  title: string;
  pageCount: number;
  chunkCount: number;
  injectionFlagsDetected: number;
}

function chunkText(text: string, maxChars = 360, overlap = 60): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + maxChars);
    chunks.push(clean.slice(start, end).trim());
    if (end === clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function decodePdfTextOperators(streamText: string): string {
  const parts: string[] = [];
  // Match literal strings (...)
  for (const m of streamText.matchAll(/\(([^()\\]{2,400})\)/g)) {
    const s = m[1].trim();
    if (/[a-zA-Z0-9äöüÄÖÜß]/.test(s)) parts.push(s);
  }
  // Match hex strings <...> followed by Tj / TJ
  for (const m of streamText.matchAll(/<([0-9A-Fa-f]{4,800})>/g)) {
    const hex = m[1];
    if (hex.length % 2 !== 0) continue;
    const decoded = Buffer.from(hex, 'hex').toString('latin1').trim();
    if (decoded.length >= 2 && /^[\x20-\x7E\xA0-\xFF]+$/.test(decoded)) {
      parts.push(decoded);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts text per page from PDF content streams (supports both uncompressed and FlateDecode streams).
 */
export async function extractPagesFromPdfBytes(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const result: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const contentsRef = page.node.get(PDFName.of('Contents'));
    const streamChunks: string[] = [];

    const readStreamObj = (obj: unknown) => {
      const resolved = obj && typeof (obj as any).objectNumber === 'number'
        ? doc.context.lookup(obj as any)
        : obj;
      if (resolved instanceof PDFRawStream) {
        const raw = resolved.getContents();
        let text = '';
        try {
          text = zlib.inflateSync(raw).toString('latin1');
        } catch {
          text = Buffer.from(raw).toString('latin1');
        }
        const extracted = decodePdfTextOperators(text);
        if (extracted) streamChunks.push(extracted);
      }
    };

    if (contentsRef) {
      const looked = doc.context.lookup(contentsRef);
      if (looked && typeof (looked as any).asArray === 'function') {
        for (const item of (looked as any).asArray()) {
          readStreamObj(item);
        }
      } else {
        readStreamObj(looked);
      }
    }

    result.push(streamChunks.join(' ').trim() || `(PDF-Seite ${i + 1})`);
  }

  return result;
}

export class LocalRagStore {
  private readonly db: DatabaseSync;

  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rag_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        document_title TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        had_injection INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
        content,
        document_title,
        content='rag_chunks',
        content_rowid='id'
      );
    `);
  }

  public ingestPages(
    title: string,
    pages: string[],
    sourceType: 'PDF' | 'TEXT' = 'TEXT',
    customDocId?: string,
  ): IngestResult {
    const docId = customDocId ?? `doc-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        'INSERT INTO rag_documents (id, title, source_type, page_count, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(docId, title, sourceType, pages.length, now);

    const insertChunk = this.db.prepare(
      'INSERT INTO rag_chunks (document_id, document_title, page_number, content, embedding_json, had_injection) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const insertFts = this.db.prepare(
      'INSERT INTO rag_chunks_fts (rowid, content, document_title) VALUES (?, ?, ?)',
    );

    let chunkCount = 0;
    let injectionFlagsDetected = 0;

    pages.forEach((rawPage, idx) => {
      const pageNumber = idx + 1;
      const pieces = chunkText(rawPage);
      for (const piece of pieces) {
        const scan = scanAndSanitizePromptInjection(piece);
        if (scan.detected) injectionFlagsDetected += 1;
        const emb = computeLocalEmbedding(scan.sanitizedText);
        const info = insertChunk.run(
          docId,
          title,
          pageNumber,
          scan.sanitizedText,
          JSON.stringify(emb),
          scan.detected ? 1 : 0,
        );
        insertFts.run(Number(info.lastInsertRowid), scan.sanitizedText, title);
        chunkCount += 1;
      }
    });

    return {
      documentId: docId,
      title,
      pageCount: pages.length,
      chunkCount,
      injectionFlagsDetected,
    };
  }

  public async ingestPdf(title: string, pdfBytes: Uint8Array): Promise<IngestResult> {
    const pages = await extractPagesFromPdfBytes(pdfBytes);
    return this.ingestPages(title, pages, 'PDF');
  }

  public query(userQuery: string, limit = 5): RagQueryResult {
    const sanitizedQuery = scanAndSanitizePromptInjection(userQuery).sanitizedText;
    const queryEmb = computeLocalEmbedding(sanitizedQuery);

    // 1. FTS5 match set (safe tokenization)
    const tokens = sanitizedQuery
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const ftsScores = new Map<number, number>();
    if (tokens.length > 0) {
      const ftsQuery = tokens.map((t) => `"${t}"`).join(' OR ');
      try {
        const rows = this.db
          .prepare('SELECT rowid, bm25(rag_chunks_fts) as rank FROM rag_chunks_fts WHERE rag_chunks_fts MATCH ? LIMIT 25')
          .all(ftsQuery) as Array<{ rowid: number; rank: number }>;
        for (const r of rows) {
          // bm25 is negative (more negative = better) in SQLite FTS5
          ftsScores.set(Number(r.rowid), 1 / (1 + Math.abs(r.rank)));
        }
      } catch {
        // Fallback to vector-only if FTS syntax cannot parse
      }
    }

    // 2. Hybrid ranking with local cosine embeddings
    const allChunks = this.db
      .prepare('SELECT id, document_id, document_title, page_number, content, embedding_json, had_injection FROM rag_chunks')
      .all() as Array<{
      id: number;
      document_id: string;
      document_title: string;
      page_number: number;
      content: string;
      embedding_json: string;
      had_injection: number;
    }>;

    let injectionBlockedCount = 0;
    const scored: RagCitation[] = [];

    for (const row of allChunks) {
      if (row.had_injection) injectionBlockedCount += 1;
      const emb = JSON.parse(row.embedding_json) as number[];
      const vecScore = cosineSimilarity(queryEmb, emb);
      const ftsScore = ftsScores.get(row.id) ?? 0;
      const hybridScore = Number((vecScore * 0.65 + ftsScore * 0.35).toFixed(4));

      if (hybridScore >= 0.22) {
        scored.push({
          chunkId: row.id,
          documentId: row.document_id,
          documentTitle: row.document_title,
          pageNumber: row.page_number,
          excerpt: row.content,
          score: hybridScore,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    if (top.length === 0) {
      return {
        status: 'UNCONFIRMED_NO_SOURCE',
        verified: false,
        query: sanitizedQuery,
        citations: [],
        injectionBlockedCount,
      };
    }

    return {
      status: 'CONFIRMED_WITH_SOURCE',
      verified: true,
      query: sanitizedQuery,
      citations: top,
      injectionBlockedCount,
    };
  }

  public listDocuments(): Array<{ id: string; title: string; sourceType: string; pageCount: number }> {
    return this.db
      .prepare('SELECT id, title, source_type as sourceType, page_count as pageCount FROM rag_documents ORDER BY created_at DESC')
      .all() as Array<{ id: string; title: string; sourceType: string; pageCount: number }>;
  }

  public deleteAll(): void {
    this.db.exec('DELETE FROM rag_chunks_fts; DELETE FROM rag_chunks; DELETE FROM rag_documents;');
  }

  public close(): void {
    this.db.close();
  }
}
