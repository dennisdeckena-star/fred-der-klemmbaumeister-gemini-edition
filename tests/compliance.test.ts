import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConceptStudioService } from '../src/core/concept/conceptStudio';

const ROOT = path.resolve(__dirname, '..');

describe('Phase 4.2: EU AI Act Art. 50 & DSGVO Compliance', () => {
  it('stellt COMPLIANCE_MATRIX.md sowie sichtbare & maschinenlesbare EU-AI-Act-Kennzeichnungen bereit', async () => {
    const matrixPath = path.join(ROOT, 'COMPLIANCE_MATRIX.md');
    expect(fs.existsSync(matrixPath)).toBe(true);
    const matrix = fs.readFileSync(matrixPath, 'utf8');
    expect(matrix).toContain('EU AI Act Art. 50');
    expect(matrix).toContain('DSGVO Art. 17');
    expect(matrix).toContain('DSGVO Art. 20');

    const chatUi = fs.readFileSync(
      path.join(ROOT, 'src', 'renderer', 'components', 'FredChatPanel.tsx'),
      'utf8',
    );
    expect(chatUi).toContain('EU AI Act Art. 50');
    expect(chatUi).toContain('KI-Assistent');

    const studio = new ConceptStudioService({ useOfflineAdapter: true });
    const session = await studio.createConcept('Compliance-Test', 'Kleines rotes Haus');
    const rev = session.revisions[0];
    expect(rev.metadata.ai_generated).toBe(true);
    expect(rev.metadata.eu_ai_act_art50).toBe('SYNTHETIC_CONCEPT_PREVIEW');
    expect(rev.metadata.isConceptOnlyNotCadModel).toBe(true);
  });
});
