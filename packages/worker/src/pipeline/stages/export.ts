import fs from 'node:fs/promises';
import path from 'node:path';
import { WireframeNode, FigmaNode, FigmaExportPayload } from '@repoframe/shared';
import { writeArtifactFile, getArtifactsPath, readJob, appendLog } from '../context.js';

export async function exportArtifacts(jobId: string): Promise<string[]> {
  const artifactsDir = getArtifactsPath(jobId);
  const artifacts: string[] = [];

  try {
    const files = await fs.readdir(artifactsDir);

    // Find wireframe JSON files and generate Figma exports
    const wireframeFiles = files.filter(f => f.startsWith('wireframe-') && f.endsWith('.json'));

    for (const wfFile of wireframeFiles) {
      try {
        const content = await fs.readFile(path.join(artifactsDir, wfFile), 'utf-8');
        const wireframeDoc = JSON.parse(content);

        // Generate Figma export
        const figmaPayload = convertToFigmaPayload(jobId, wireframeDoc);
        const figmaFilename = wfFile.replace('wireframe-', 'figma-export-');
        await writeArtifactFile(jobId, figmaFilename, JSON.stringify(figmaPayload, null, 2));
        artifacts.push(figmaFilename);
      } catch (err: any) {
        await appendLog(jobId, 'pipeline.log', `[export] Error processing ${wfFile}: ${err.message}`);
      }
    }

    // List all generated artifacts
    const allFiles = await fs.readdir(artifactsDir);
    artifacts.push(...allFiles.filter(f => !artifacts.includes(f)));

    await appendLog(jobId, 'pipeline.log', `[export] Generated ${artifacts.length} artifacts`);
  } catch (err: any) {
    await appendLog(jobId, 'pipeline.log', `[export] Error listing artifacts: ${err.message}`);
  }

  return [...new Set(artifacts)];
}

function convertToFigmaPayload(jobId: string, wireframeDoc: any): FigmaExportPayload {
  const root = wireframeDoc.root as WireframeNode;
  const figmaChildren = convertNodeToFigma(root);

  return {
    version: '1.0',
    jobId,
    route: wireframeDoc.route,
    document: {
      name: `RepoFrame - ${wireframeDoc.route}`,
      children: [figmaChildren],
    },
    components: extractComponents(root),
    exportedAt: new Date().toISOString(),
  };
}

function convertNodeToFigma(node: WireframeNode): FigmaNode {
  const figmaNode: FigmaNode = {
    type: mapToFigmaType(node.type),
    name: node.name || node.type,
    x: node.bounds.x,
    y: node.bounds.y,
    width: node.bounds.width,
    height: node.bounds.height,
  };

  // Set fills
  if (node.backgroundColor) {
    const color = parseColor(node.backgroundColor);
    if (color) {
      figmaNode.fills = [{ type: 'SOLID', color }];
    }
  }

  // Set strokes
  if (node.borderColor) {
    const color = parseColor(node.borderColor);
    if (color) {
      figmaNode.strokes = [{ type: 'SOLID', color }];
    }
  }

  // Set corner radius
  if (node.borderRadius) {
    figmaNode.cornerRadius = node.borderRadius;
  }

  // Set text properties
  if (node.textContent && ['text', 'heading', 'paragraph', 'button', 'badge'].includes(node.type)) {
    figmaNode.type = 'TEXT';
    figmaNode.characters = node.textContent;
    figmaNode.fontSize = node.textStyle?.fontSize || 14;
    figmaNode.fontWeight = parseInt(node.textStyle?.fontWeight || '400') || 400;
  }

  // Set layout
  if (node.layout) {
    if (node.layout.display === 'flex') {
      figmaNode.layoutMode = node.layout.flexDirection === 'column' ? 'VERTICAL' : 'HORIZONTAL';
      figmaNode.itemSpacing = node.layout.gap || 0;
    }
    if (node.layout.justifyContent) {
      figmaNode.primaryAxisAlignItems = mapAlignment(node.layout.justifyContent);
    }
    if (node.layout.alignItems) {
      figmaNode.counterAxisAlignItems = mapAlignment(node.layout.alignItems);
    }
  }

  // Set padding
  if (node.padding) {
    figmaNode.paddingTop = node.padding.top;
    figmaNode.paddingRight = node.padding.right;
    figmaNode.paddingBottom = node.padding.bottom;
    figmaNode.paddingLeft = node.padding.left;
  }

  // Process children
  if (node.children.length > 0) {
    figmaNode.children = node.children.map(convertNodeToFigma);
  }

  return figmaNode;
}

function mapToFigmaType(type: string): any {
  switch (type) {
    case 'frame': case 'section': case 'group': case 'card':
    case 'nav': case 'sidebar': case 'header': case 'footer':
    case 'modal': return 'FRAME';
    case 'text': case 'heading': case 'paragraph': return 'TEXT';
    case 'button': return 'COMPONENT';
    case 'input': case 'textarea': case 'select': return 'FRAME';
    case 'image-placeholder': return 'RECTANGLE';
    case 'icon-placeholder': return 'ELLIPSE';
    case 'table': case 'row': case 'column': return 'FRAME';
    case 'badge': return 'FRAME';
    case 'divider': return 'RECTANGLE';
    case 'checkbox': case 'radio': return 'FRAME';
    default: return 'FRAME';
  }
}

function mapAlignment(value: string): string {
  switch (value) {
    case 'flex-start': case 'start': return 'MIN';
    case 'flex-end': case 'end': return 'MAX';
    case 'center': return 'CENTER';
    case 'space-between': return 'SPACE_BETWEEN';
    default: return 'MIN';
  }
}

function parseColor(cssColor: string): { r: number; g: number; b: number; a: number } | null {
  // Parse rgb/rgba
  const rgbaMatch = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]) / 255,
      g: parseInt(rgbaMatch[2]) / 255,
      b: parseInt(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Parse hex
  const hexMatch = cssColor.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  return null;
}

function extractComponents(root: WireframeNode): Record<string, FigmaNode> {
  const components: Record<string, FigmaNode> = {};

  function traverse(node: WireframeNode) {
    // Extract reusable components
    if (node.type === 'button') {
      const key = `button-${node.textContent || 'default'}`;
      if (!components[key]) {
        components[key] = convertNodeToFigma(node);
        components[key].type = 'COMPONENT';
      }
    }
    if (node.type === 'card') {
      const key = `card-${node.name || 'default'}`;
      if (!components[key]) {
        components[key] = convertNodeToFigma(node);
        components[key].type = 'COMPONENT';
      }
    }
    if (node.type === 'input') {
      const key = `input-${node.placeholder || 'default'}`;
      if (!components[key]) {
        components[key] = convertNodeToFigma(node);
        components[key].type = 'COMPONENT';
      }
    }

    node.children.forEach(traverse);
  }

  traverse(root);
  return components;
}
