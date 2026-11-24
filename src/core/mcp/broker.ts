import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CadToolDefinition } from '../tools';

export type McpPermission = 'READ' | 'WRITE' | 'EXPORT';

export interface McpRegisteredTool {
  definition: CadToolDefinition<any, any>;
  permission: McpPermission;
  timeoutMs: number;
}

export interface McpAuditEntry {
  id: string;
  timestamp: string;
  caller: string;
  toolName: string;
  permission: McpPermission | 'UNKNOWN';
  argsSha256: string;
  status: 'ALLOWED' | 'DENIED' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'EXECUTION_ERROR';
  durationMs: number;
  errorMessage?: string;
}

export interface McpBrokerOptions {
  allowedPermissions?: McpPermission[];
  defaultTimeoutMs?: number;
}

function classifyToolPermission(toolName: string): McpPermission {
  if (
    toolName.startsWith('catalog.') ||
    toolName.startsWith('geometry.') ||
    toolName.startsWith('connections.') ||
    toolName === 'model.validate' ||
    toolName === 'bom.generate' ||
    toolName.startsWith('render.') ||
    toolName.startsWith('instructions.') ||
    toolName.startsWith('nano_banana.') ||
    toolName.startsWith('hf_flux.') ||
    toolName.startsWith('cf_flux.') ||
    toolName.startsWith('pollinations_flux.') ||
    toolName.startsWith('image_router.')
  ) {
    return 'READ';
  }
  if (toolName === 'pdf.export' || toolName === 'model.save') {
    return 'EXPORT';
  }
  return 'WRITE';
}

export class FredMcpBroker {
  private readonly registry = new Map<string, McpRegisteredTool>();
  private readonly auditLog: McpAuditEntry[] = [];
  private readonly allowedPermissions: Set<McpPermission>;
  private readonly defaultTimeoutMs: number;
  private auditSeq = 0;

  constructor(options: McpBrokerOptions = {}) {
    this.allowedPermissions = new Set(options.allowedPermissions ?? ['READ', 'WRITE', 'EXPORT']);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  }

  public registerTool(
    definition: CadToolDefinition<any, any>,
    permission?: McpPermission,
    timeoutMs?: number,
  ): void {
    this.registry.set(definition.name, {
      definition,
      permission: permission ?? classifyToolPermission(definition.name),
      timeoutMs: timeoutMs ?? this.defaultTimeoutMs,
    });
  }

  public registerCadTools(tools: Map<string, CadToolDefinition<any, any>>): void {
    for (const def of tools.values()) {
      this.registerTool(def);
    }
  }

  public listTools(): Array<{
    name: string;
    description: string;
    permission: McpPermission;
    timeoutMs: number;
  }> {
    return Array.from(this.registry.values()).map((entry) => ({
      name: entry.definition.name,
      description: entry.definition.description,
      permission: entry.permission,
      timeoutMs: entry.timeoutMs,
    }));
  }

  public getAuditLog(): McpAuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(entry: Omit<McpAuditEntry, 'id' | 'timestamp'>): void {
    this.auditSeq += 1;
    this.auditLog.push({
      id: `audit-${this.auditSeq}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }

  public async invoke<T = unknown>(
    toolName: string,
    rawArgs: unknown,
    caller = 'fred-agent',
  ): Promise<T> {
    const start = Date.now();
    const argsSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify(rawArgs ?? null))
      .digest('hex')
      .slice(0, 16);

    const registered = this.registry.get(toolName);
    if (!registered) {
      const msg = `MCP_DENIED: Tool '${toolName}' ist nicht freigegeben (keine Freitext- oder Shell-Befehle erlaubt).`;
      this.appendAudit({
        caller,
        toolName,
        permission: 'UNKNOWN',
        argsSha256,
        status: 'DENIED',
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      throw new Error(msg);
    }

    if (!this.allowedPermissions.has(registered.permission)) {
      const msg = `MCP_DENIED: Fehlende Berechtigung '${registered.permission}' für Tool '${toolName}'.`;
      this.appendAudit({
        caller,
        toolName,
        permission: registered.permission,
        argsSha256,
        status: 'DENIED',
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      throw new Error(msg);
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = registered.definition.inputSchema.parse(rawArgs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ungültiges Eingabeschema';
      this.appendAudit({
        caller,
        toolName,
        permission: registered.permission,
        argsSha256,
        status: 'VALIDATION_ERROR',
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      throw new Error(`MCP_VALIDATION_ERROR (${toolName}): ${msg}`);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const execPromise = Promise.resolve(registered.definition.execute(parsedArgs));
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`MCP_TIMEOUT: Tool '${toolName}' überschritt ${registered.timeoutMs} ms.`));
        }, registered.timeoutMs);
      });

      const result = (await Promise.race([execPromise, timeoutPromise])) as T;
      this.appendAudit({
        caller,
        toolName,
        permission: registered.permission,
        argsSha256,
        status: 'ALLOWED',
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ausführungsfehler';
      const isTimeout = msg.startsWith('MCP_TIMEOUT');
      this.appendAudit({
        caller,
        toolName,
        permission: registered.permission,
        argsSha256,
        status: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
        durationMs: Date.now() - start,
        errorMessage: msg,
      });
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Builds a standards-compliant Model Context Protocol SDK Server backed by this broker.
   */
  public createProtocolServer(): Server {
    const server = new Server(
      { name: 'fred-internal-mcp-broker', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: { type: 'object' as const, properties: {} },
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const result = await this.invoke(
        request.params.name,
        request.params.arguments ?? {},
        'mcp-sdk-client',
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    });

    return server;
  }
}
