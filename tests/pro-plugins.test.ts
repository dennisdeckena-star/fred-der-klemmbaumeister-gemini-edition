import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExternalMcpBridgeRegistry } from '../src/core/mcp/externalBridge';
import { buildProBuilderSystemPrompt, PRO_BUILDER_ENGINEERING_RULES } from '../plugins/fred-pro-builder/scripts/snot_engineering_rules';

const ROOT = path.resolve(__dirname, '..');

describe('Fred Pro-Builder Plugin & External Builder MCP Bridge', () => {
  it('stellt verifizierte externe Builder-MCP-Server (ldraw-mcp, brick-mcp, blender-mcp) konfigurierbar bereit', () => {
    const registry = new ExternalMcpBridgeRegistry();
    const list = registry.listProfiles();
    expect(list.map((p) => p.id)).toEqual(['ldraw-mcp', 'brick-mcp', 'blender-mcp']);

    registry.setEnabled('ldraw-mcp', true);
    registry.setEnabled('brick-mcp', true);
    const cfg = registry.exportMcpClientConfig();
    expect(Object.keys(cfg.mcpServers)).toEqual(['ldraw-mcp', 'brick-mcp']);
  });

  it('stellt das fred-pro-builder Plugin inkl. Blender-Cycles-Skript, LDraw-Sync & AFOL-Regelwerk bereit', () => {
    const manifestPath = path.join(ROOT, 'plugins', 'fred-pro-builder', 'plugin.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('fred-pro-builder');
    expect(manifest.compatibleMcpServers).toContain('musharna/ldraw-mcp');
    expect(manifest.compatibleMcpServers).toContain('datakurre/brick-mcp');

    expect(fs.existsSync(path.join(ROOT, 'plugins', 'fred-pro-builder', 'scripts', 'render_cycles_ldraw.py'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'plugins', 'fred-pro-builder', 'scripts', 'sync_ldraw_library.mjs'))).toBe(true);

    expect(PRO_BUILDER_ENGINEERING_RULES.length).toBeGreaterThanOrEqual(5);
    expect(buildProBuilderSystemPrompt()).toContain('SNOT');
  });
});

  it('beherrscht moderne Technic-Skelett- & SNOT-Cladding-Teile (64179, 32524, 4274, 99781, 87087, 15573) und findet sie per RAG mit Quelle', async () => {
    const { getPartById } = await import('../src/core/ldraw');
    const { LocalRagStore } = await import('../src/core/rag/ragStore');

    for (const id of ['64179.dat', '32524.dat', '4274.dat', '99781.dat', '87087.dat', '15573.dat']) {
      expect(getPartById(id), `Teil ${id} fehlt im Katalog`).toBeDefined();
    }

    const kbPath = path.join(ROOT, 'plugins', 'fred-pro-builder', 'knowledge', 'AFOL_TECHNIC_TECHNIQUES.md');
    expect(fs.existsSync(kbPath)).toBe(true);

    const rag = new LocalRagStore(':memory:');
    rag.ingestPages('AFOL_TECHNIC_TECHNIQUES.md', [fs.readFileSync(kbPath, 'utf8')], 'TEXT');
    const hit = rag.query('5:2 SNOT Verhältnis Torsionsbox 64179 Bracket Verkleidung');
    expect(hit.verified).toBe(true);
    expect(hit.citations[0].documentTitle).toBe('AFOL_TECHNIC_TECHNIQUES.md');
    rag.close();
  });
