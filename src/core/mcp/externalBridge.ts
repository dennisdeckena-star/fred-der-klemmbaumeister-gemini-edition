export interface ExternalMcpServerProfile {
  id: 'ldraw-mcp' | 'brick-mcp' | 'blender-mcp';
  name: string;
  repositoryUrl: string;
  purpose: string;
  transport: 'stdio';
  command: string;
  args: string[];
  requiresLocalTools: string[];
  enabled: boolean;
}

export const RECOMMENDED_BUILDER_MCP_SERVERS: ExternalMcpServerProfile[] = [
  {
    id: 'ldraw-mcp',
    name: 'LDraw Photorealistic Render MCP (musharna/ldraw-mcp)',
    repositoryUrl: 'https://github.com/musharna/ldraw-mcp',
    purpose:
      'Rendert LDraw-Modelle (.ldr/.mpd) über Headless-Blender + ImportLDraw fotorealistisch mit echten Noppen, Glas, Reifen und Kanten – gibt Gemini echtes visuelles Feedback.',
    transport: 'stdio',
    command: 'uvx',
    args: ['ldraw-mcp'],
    requiresLocalTools: ['blender', 'ImportLDraw', 'LDraw Complete Library'],
    enabled: false,
  },
  {
    id: 'brick-mcp',
    name: 'BrickLink Studio MCP (datakurre/brick-mcp)',
    repositoryUrl: 'https://github.com/datakurre/brick-mcp',
    purpose:
      'Erstellt, prüft und bearbeitet hochdetaillierte Klemmbaustein-Modelle direkt im BrickLink-Studio-Format (.io) mit Zugriff auf den kompletten Teilekatalog.',
    transport: 'stdio',
    command: 'uvx',
    args: ['brick-mcp'],
    requiresLocalTools: ['python3', 'uv'],
    enabled: false,
  },
  {
    id: 'blender-mcp',
    name: 'Blender Cycles Studio MCP (ahujasid/blender-mcp)',
    repositoryUrl: 'https://github.com/ahujasid/blender-mcp',
    purpose:
      'Steuert Blender Cycles Path-Tracing, HDRI-Studio-Beleuchtung, Principled-BSDF-ABS-Shader und OpenImageDenoise für Katalog-Qualitäts-Renderings.',
    transport: 'stdio',
    command: 'uvx',
    args: ['blender-mcp'],
    requiresLocalTools: ['blender'],
    enabled: false,
  },
];

export class ExternalMcpBridgeRegistry {
  private profiles: Map<string, ExternalMcpServerProfile>;

  constructor(initial: ExternalMcpServerProfile[] = RECOMMENDED_BUILDER_MCP_SERVERS) {
    this.profiles = new Map(initial.map((p) => [p.id, { ...p, args: [...p.args], requiresLocalTools: [...p.requiresLocalTools] }]));
  }

  public listProfiles(): ExternalMcpServerProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfile(id: string): ExternalMcpServerProfile | undefined {
    return this.profiles.get(id);
  }

  public setEnabled(id: string, enabled: boolean): ExternalMcpServerProfile {
    const p = this.profiles.get(id);
    if (!p) throw new Error(`Unbekanntes externes MCP-Profil: ${id}`);
    p.enabled = enabled;
    return { ...p };
  }

  public exportMcpClientConfig(): { mcpServers: Record<string, { command: string; args: string[] }> } {
    const mcpServers: Record<string, { command: string; args: string[] }> = {};
    for (const p of this.profiles.values()) {
      if (p.enabled) {
        mcpServers[p.id] = { command: p.command, args: p.args };
      }
    }
    return { mcpServers };
  }
}
