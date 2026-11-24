import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type MemoryCategory = 'PREFERENCE' | 'CORRECTION' | 'STYLE';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  ruleText: string;
  version: number;
  confirmedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryHistoryRecord {
  historyId: number;
  entryId: string;
  action: 'ADD' | 'UPDATE' | 'DELETE';
  previousText: string | null;
  newText: string | null;
  previousCategory: MemoryCategory | null;
  newCategory: MemoryCategory | null;
  previousVersion: number | null;
  timestamp: string;
}

export class FredMemoryStore {
  private readonly db: DatabaseSync;
  public readonly memoryMdPath: string;

  constructor(memoryMdPath: string, dbPath = ':memory:') {
    this.memoryMdPath = memoryMdPath;
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    this.syncMarkdownFile();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        rule_text TEXT NOT NULL,
        version INTEGER NOT NULL,
        confirmed_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_history (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_text TEXT,
        new_text TEXT,
        previous_category TEXT,
        new_category TEXT,
        previous_version INTEGER,
        timestamp TEXT NOT NULL
      );
    `);
  }

  public listEntries(): MemoryEntry[] {
    return this.db
      .prepare(
        `SELECT id, category, rule_text as ruleText, version, confirmed_by as confirmedBy,
                created_at as createdAt, updated_at as updatedAt
         FROM memory_entries ORDER BY updated_at DESC`,
      )
      .all() as unknown as MemoryEntry[];
  }

  public getHistory(): MemoryHistoryRecord[] {
    return this.db
      .prepare(
        `SELECT history_id as historyId, entry_id as entryId, action,
                previous_text as previousText, new_text as newText,
                previous_category as previousCategory, new_category as newCategory,
                previous_version as previousVersion, timestamp
         FROM memory_history ORDER BY history_id DESC`,
      )
      .all() as unknown as MemoryHistoryRecord[];
  }

  public syncMarkdownFile(): string {
    const entries = this.listEntries();
    const lines: string[] = [
      '# Fred Memory.md – Gelernte Nutzerpräferenzen & Korrekturen',
      '',
      '> Diese Datei wird automatisch mit der lokalen SQLite-Historie synchronisiert.',
      '> Du kannst Einträge jederzeit in Fred bearbeiten, rückgängig machen (Undo) oder löschen.',
      '',
    ];

    if (entries.length === 0) {
      lines.push('_Noch keine gespeicherten Präferenzen._');
    } else {
      for (const e of entries) {
        lines.push(`- **[${e.category}]** (v${e.version}, \`${e.id}\`): ${e.ruleText}`);
      }
    }

    const md = lines.join('\n') + '\n';
    fs.mkdirSync(path.dirname(this.memoryMdPath), { recursive: true });
    fs.writeFileSync(this.memoryMdPath, md, 'utf8');
    return md;
  }

  public addPreference(
    category: MemoryCategory,
    ruleText: string,
    confirmedBy = 'user',
  ): MemoryEntry {
    const clean = ruleText.trim();
    if (!clean) throw new Error('Präferenztext darf nicht leer sein.');
    const id = `mem-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        'INSERT INTO memory_entries (id, category, rule_text, version, confirmed_by, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
      )
      .run(id, category, clean, confirmedBy, now, now);

    this.db
      .prepare(
        'INSERT INTO memory_history (entry_id, action, previous_text, new_text, previous_category, new_category, previous_version, timestamp) VALUES (?, ?, NULL, ?, NULL, ?, 0, ?)',
      )
      .run(id, 'ADD', clean, category, now);

    this.syncMarkdownFile();
    return { id, category, ruleText: clean, version: 1, confirmedBy, createdAt: now, updatedAt: now };
  }

  public updatePreference(id: string, newRuleText: string): MemoryEntry {
    const existing = this.listEntries().find((e) => e.id === id);
    if (!existing) throw new Error(`Memory-Eintrag nicht gefunden: ${id}`);
    const clean = newRuleText.trim();
    const nextVersion = existing.version + 1;
    const now = new Date().toISOString();

    this.db
      .prepare('UPDATE memory_entries SET rule_text = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(clean, nextVersion, now, id);

    this.db
      .prepare(
        'INSERT INTO memory_history (entry_id, action, previous_text, new_text, previous_category, new_category, previous_version, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, 'UPDATE', existing.ruleText, clean, existing.category, existing.category, existing.version, now);

    this.syncMarkdownFile();
    return { ...existing, ruleText: clean, version: nextVersion, updatedAt: now };
  }

  public deletePreference(id: string): boolean {
    const existing = this.listEntries().find((e) => e.id === id);
    if (!existing) return false;
    const now = new Date().toISOString();

    this.db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
    this.db
      .prepare(
        'INSERT INTO memory_history (entry_id, action, previous_text, new_text, previous_category, new_category, previous_version, timestamp) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)',
      )
      .run(id, 'DELETE', existing.ruleText, existing.category, existing.version, now);

    this.syncMarkdownFile();
    return true;
  }

  public undoLastChange(): boolean {
    const latest = this.getHistory()[0];
    if (!latest) return false;
    const now = new Date().toISOString();

    if (latest.action === 'ADD') {
      this.db.prepare('DELETE FROM memory_entries WHERE id = ?').run(latest.entryId);
    } else if (latest.action === 'UPDATE' && latest.previousText !== null) {
      this.db
        .prepare('UPDATE memory_entries SET rule_text = ?, version = ?, updated_at = ? WHERE id = ?')
        .run(latest.previousText, latest.previousVersion ?? 1, now, latest.entryId);
    } else if (latest.action === 'DELETE' && latest.previousText !== null) {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO memory_entries (id, category, rule_text, version, confirmed_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          latest.entryId,
          latest.previousCategory ?? 'PREFERENCE',
          latest.previousText,
          latest.previousVersion ?? 1,
          'undo',
          now,
          now,
        );
    }

    this.db.prepare('DELETE FROM memory_history WHERE history_id = ?').run(latest.historyId);
    this.syncMarkdownFile();
    return true;
  }

  public search(query: string): MemoryEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.listEntries();
    return this.listEntries().filter(
      (e) => e.ruleText.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
    );
  }

  public exportBundle(): { markdown: string; json: string } {
    const markdown = this.syncMarkdownFile();
    const json = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        entries: this.listEntries(),
        history: this.getHistory(),
      },
      null,
      2,
    );
    return { markdown, json };
  }

  public buildSystemPromptContext(): string {
    const entries = this.listEntries();
    if (entries.length === 0) return '';
    return (
      'Bestätigte Nutzerpräferenzen aus Memory.md:\n' +
      entries.map((e) => `- [${e.category}] ${e.ruleText}`).join('\n')
    );
  }

  public clearAll(): void {
    this.db.exec('DELETE FROM memory_entries; DELETE FROM memory_history;');
    this.syncMarkdownFile();
  }

  public close(): void {
    this.db.close();
  }
}
