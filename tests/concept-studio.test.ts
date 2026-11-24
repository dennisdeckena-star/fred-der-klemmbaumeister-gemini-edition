import { describe, expect, it } from 'vitest';
import { ConceptStudioService } from '../src/core/concept/conceptStudio';

describe('Phase 2.3: Konzeptstudio (Titanic-Loop & striktes Freigabe-Gate)', () => {
  it('erzeugt Konzeptvorschau mit EU-AI-Act-Metadaten, durchläuft Änderungs-Loop und erzwingt Freigabe-Gate', async () => {
    const studio = new ConceptStudioService({ useOfflineAdapter: true });

    const session = await studio.createConcept(
      'Titanic Mini',
      'Historisches Passagierschiff mit vier Schornsteinen',
      'STANDARD',
    );

    expect(session.status).toBe('PENDING_APPROVAL');
    expect(session.revisions).toHaveLength(1);
    expect(session.revisions[0].metadata.ai_generated).toBe(true);
    expect(session.revisions[0].metadata.isConceptOnlyNotCadModel).toBe(true);
    expect(session.revisions[0].recommendations).toHaveLength(3);

    // Gate MUST block CAD construction before approval
    expect(() => studio.buildDeterministicModelFromApprovedConcept(session.id)).toThrow(
      /CONCEPT_NOT_APPROVED/,
    );

    // Iterative revision loop
    const revised = await studio.reviseConcept(
      session.id,
      'Rumpf etwas länger und weniger sichtbare Noppen',
      'DISPLAY',
    );
    expect(revised.revisions).toHaveLength(2);
    expect(revised.status).toBe('PENDING_APPROVAL');

    // Still blocked until explicit approval of revision 2
    expect(() => studio.assertApprovedForCad(session.id)).toThrow(/CONCEPT_NOT_APPROVED/);

    // Explicit approval
    const approved = studio.approveConcept(session.id, 'Dennis');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedRevision).toBe(2);

    // Now deterministic 3D CAD construction succeeds
    const cadModel = studio.buildDeterministicModelFromApprovedConcept(session.id);
    expect(cadModel.name).toBe('Titanic Mini');
    expect(cadModel.parts.length).toBeGreaterThan(5);
    expect(cadModel.metadata.approvedRevision).toBe(2);
  });
});
