import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

describe('Phase 1.1: Grundgerüst & App-Icon', () => {
  it('stellt fred-icon.png, fred-icon.ico und ui-vorlage.png bereit', () => {
    expect(fs.existsSync(path.join(ROOT, 'fred-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'ui-vorlage.png'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'assets', 'fred-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'assets', 'fred-icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public', 'fred-icon.png'))).toBe(true);
  });

  it('nutzt ausschließlich Google Gen AI und keine OpenAI-Abhängigkeiten', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['@google/genai']).toBeDefined();
    expect(allDeps['openai']).toBeUndefined();
  });
});
