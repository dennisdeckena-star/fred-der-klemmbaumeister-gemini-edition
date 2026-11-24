import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FredMemoryStore } from '../src/core/memory/memoryStore';

describe('Phase 3.2: Lernfähige Memory (Memory.md + SQLite-Historie, Versionierung, Suche, Export, Undo)', () => {
  it('speichert Präferenzen & Korrekturen dauerhaft in Memory.md, unterstützt Versionierung, Suche, Export, Löschung & Undo', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fred-mem-'));
    const mdPath = path.join(tmpDir, 'Memory.md');
    const store = new FredMemoryStore(mdPath, ':memory:');

    const e1 = store.addPreference('PREFERENCE', 'Weniger sichtbare Noppen – glatte Tiles bevorzugen', 'Dennis');
    const e2 = store.addPreference('CORRECTION', 'So nicht: Heckkabine immer mit gelber Reling abschließen', 'Dennis');

    expect(fs.existsSync(mdPath)).toBe(true);
    expect(fs.readFileSync(mdPath, 'utf8')).toContain('Weniger sichtbare Noppen');

    // Update -> version increments to 2
    const updated = store.updatePreference(e1.id, 'Möglichst keine sichtbaren Noppen (glatte Tiles 3069b/2431)');
    expect(updated.version).toBe(2);

    // Search
    const found = store.search('Noppen');
    expect(found).toHaveLength(1);
    expect(found[0].version).toBe(2);

    // Delete + Undo restores deleted entry
    expect(store.deletePreference(e2.id)).toBe(true);
    expect(store.listEntries()).toHaveLength(1);

    expect(store.undoLastChange()).toBe(true);
    expect(store.listEntries()).toHaveLength(2);
    expect(fs.readFileSync(mdPath, 'utf8')).toContain('Heckkabine');

    // Undo the update -> reverts to version 1
    expect(store.undoLastChange()).toBe(true);
    expect(store.search('Noppen')[0].version).toBe(1);

    // Export bundle
    const bundle = store.exportBundle();
    expect(bundle.markdown).toContain('Fred Memory.md');
    expect(JSON.parse(bundle.json).entries).toHaveLength(2);

    // System prompt injection
    expect(store.buildSystemPromptContext()).toContain('Weniger sichtbare Noppen');

    store.close();
  });
});
