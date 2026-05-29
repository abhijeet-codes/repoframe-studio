import { WireframeNode, FigmaNode, FigmaExportPayload } from '@repoframe/shared';

export interface FigmaAdapter {
  name: string;
  convert(wireframeDoc: any): FigmaExportPayload;
}

export class FigmaExportAdapter implements FigmaAdapter {
  name = 'export';

  convert(wireframeDoc: any): FigmaExportPayload {
    const root = wireframeDoc.root as WireframeNode;
    return {
      version: '1.0',
      jobId: wireframeDoc.jobId,
      route: wireframeDoc.route,
      document: {
        name: `RepoFrame - ${wireframeDoc.route}`,
        children: [this.convertNode(root)],
      },
      components: this.extractComponents(root),
      exportedAt: new Date().toISOString(),
    };
  }

  private convertNode(node: WireframeNode): FigmaNode {
    const figmaNode: FigmaNode = {
      type: this.mapType(node.type),
      name: node.name || node.type,
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.width,
      height: node.bounds.height,
    };

    if (node.backgroundColor) {
      const color = this.parseColor(node.backgroundColor);
      if (color) figmaNode.fills = [{ type: 'SOLID', color }];
    }

    if (node.borderRadius) figmaNode.cornerRadius = node.borderRadius;

    if (node.textContent) {
      figmaNode.characters = node.textContent;
      figmaNode.fontSize = node.textStyle?.fontSize || 14;
    }

    if (node.layout?.display === 'flex') {
      figmaNode.layoutMode = node.layout.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
      figmaNode.itemSpacing = node.layout.gap || 0;
    }

    if (node.padding) {
      figmaNode.paddingTop = node.padding.top;
      figmaNode.paddingRight = node.padding.right;
      figmaNode.paddingBottom = node.padding.bottom;
      figmaNode.paddingLeft = node.padding.left;
    }

    if (node.children.length > 0) {
      figmaNode.children = node.children.map(c => this.convertNode(c));
    }

    return figmaNode;
  }

  private mapType(type: string): any {
    const mapping: Record<string, string> = {
      frame: 'FRAME', section: 'FRAME', group: 'GROUP', card: 'FRAME',
      nav: 'FRAME', sidebar: 'FRAME', header: 'FRAME', footer: 'FRAME',
      modal: 'FRAME', text: 'TEXT', heading: 'TEXT', paragraph: 'TEXT',
      button: 'COMPONENT', input: 'FRAME', textarea: 'FRAME', select: 'FRAME',
      'image-placeholder': 'RECTANGLE', 'icon-placeholder': 'ELLIPSE',
      table: 'FRAME', row: 'FRAME', column: 'FRAME',
      badge: 'FRAME', divider: 'RECTANGLE', checkbox: 'FRAME', radio: 'FRAME',
    };
    return mapping[type] || 'FRAME';
  }

  private parseColor(css: string): { r: number; g: number; b: number; a: number } | undefined {
    const rgba = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgba) {
      return {
        r: parseInt(rgba[1]) / 255,
        g: parseInt(rgba[2]) / 255,
        b: parseInt(rgba[3]) / 255,
        a: rgba[4] ? parseFloat(rgba[4]) : 1,
      };
    }
    return undefined;
  }

  private extractComponents(root: WireframeNode): Record<string, FigmaNode> {
    const components: Record<string, FigmaNode> = {};
    const traverse = (node: WireframeNode) => {
      if (node.type === 'button') {
        const key = `button-${node.textContent || 'default'}`;
        if (!components[key]) {
          const n = this.convertNode(node);
          n.type = 'COMPONENT';
          components[key] = n;
        }
      }
      if (node.type === 'card') {
        const key = `card-${node.name || 'default'}`;
        if (!components[key]) {
          const n = this.convertNode(node);
          n.type = 'COMPONENT';
          components[key] = n;
        }
      }
      if (node.type === 'input') {
        const key = `input-${node.placeholder || 'default'}`;
        if (!components[key]) {
          const n = this.convertNode(node);
          n.type = 'COMPONENT';
          components[key] = n;
        }
      }
      node.children.forEach(traverse);
    };
    traverse(root);
    return components;
  }
}

export class FigmaPluginAdapter implements FigmaAdapter {
  name = 'plugin';

  convert(wireframeDoc: any): FigmaExportPayload {
    // Same output format but structured for Figma plugin consumption
    const exporter = new FigmaExportAdapter();
    const payload = exporter.convert(wireframeDoc);
    // Plugin expects component instances to reference componentId
    return payload;
  }
}

export class FigmaMcpAdapter implements FigmaAdapter {
  name = 'mcp';

  convert(wireframeDoc: any): FigmaExportPayload {
    // MCP adapter generates payload for AI model consumption
    const exporter = new FigmaExportAdapter();
    const payload = exporter.convert(wireframeDoc);
    // Add additional metadata for MCP context
    return {
      ...payload,
      version: '1.0-mcp',
    };
  }
}
