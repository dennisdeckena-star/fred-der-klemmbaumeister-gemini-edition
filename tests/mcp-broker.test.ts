import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FredMcpBroker } from '../src/core/mcp/broker';
import { CadWorkspaceStore, createCadTools } from '../src/core/tools';

describe('Phase 2.2: Produktinterner MCP-Broker (Schemas, Berechtigungen, Timeouts, Audit-Log)', () => {
  it('schaltet nur geprüfte CAD-Tools frei, blockiert Freitext-/Shell-Aufrufe und protokolliert im Audit-Log', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fred-mcp-'));
    const store = new CadWorkspaceStore(tmpDir);
    const cadTools = createCadTools(store);

    const broker = new FredMcpBroker({ allowedPermissions: ['READ', 'WRITE', 'EXPORT'] });
    broker.registerCadTools(cadTools);
    expect(broker.listTools()).toHaveLength(18);

    // Allowed tool call
    const parts = await broker.invoke<any[]>('catalog.search_parts', { query: 'Slope' });
    expect(parts.length).toBeGreaterThanOrEqual(1);

    // Unregistered shell/free-text command must be DENIED
    await expect(broker.invoke('shell.exec', { cmd: 'rm -rf /' })).rejects.toThrow(/MCP_DENIED/);

    // Invalid schema must trigger VALIDATION_ERROR
    await expect(broker.invoke('model.create', { name: '' })).rejects.toThrow(/MCP_VALIDATION_ERROR/);

    const log = broker.getAuditLog();
    expect(log).toHaveLength(3);
    expect(log[0].status).toBe('ALLOWED');
    expect(log[1].status).toBe('DENIED');
    expect(log[2].status).toBe('VALIDATION_ERROR');

    // MCP SDK protocol server instantiation succeeds
    const sdkServer = broker.createProtocolServer();
    expect(sdkServer).toBeDefined();
  });

  it('erzwingt Berechtigungsstufen (READ-only blockiert WRITE) und Timeouts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fred-mcp-ro-'));
    const store = new CadWorkspaceStore(tmpDir);
    const cadTools = createCadTools(store);

    const roBroker = new FredMcpBroker({ allowedPermissions: ['READ'] });
    roBroker.registerCadTools(cadTools);

    await expect(roBroker.invoke('model.create', { name: 'Verboten' })).rejects.toThrow(/MCP_DENIED/);

    // Timeout enforcement test
    roBroker.registerTool(
      {
        name: 'test.slow_tool',
        description: 'Simuliertes langsames Tool',
        inputSchema: z.object({}),
        execute: async () => new Promise((resolve) => setTimeout(() => resolve('late'), 200)),
      },
      'READ',
      30,
    );

    await expect(roBroker.invoke('test.slow_tool', {})).rejects.toThrow(/MCP_TIMEOUT/);
    expect(roBroker.getAuditLog().some((e) => e.status === 'TIMEOUT')).toBe(true);
  });
});
