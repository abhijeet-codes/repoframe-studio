import { WireframeNode, WireframeDocument, WireframeMode } from '@repoframe/shared';
import { writeArtifactFile, appendLog } from '../context.js';
import { randomUUID } from 'node:crypto';

interface AnalyzedRoute {
  route: string;
  url: string;
  screenshotPath?: string;
  wireframeTree: WireframeNode;
  error?: string;
}

export async function generateWireframes(
  jobId: string,
  analyses: AnalyzedRoute[],
  mode: WireframeMode
): Promise<void> {
  for (const analysis of analyses) {
    if (analysis.error && !analysis.wireframeTree.children.length) continue;

    const routeSlug = analysis.route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';

    if (mode === 'low-fi' || mode === 'both') {
      const lowFiDoc = generateLowFiDocument(jobId, analysis);
      await writeArtifactFile(jobId, `wireframe-lowfi-${routeSlug}.json`, JSON.stringify(lowFiDoc, null, 2));

      const lowFiSvg = generateLowFiSVG(lowFiDoc);
      await writeArtifactFile(jobId, `lowfi-${routeSlug}.svg`, lowFiSvg);
    }

    if (mode === 'high-fi' || mode === 'both') {
      const highFiDoc = generateHighFiDocument(jobId, analysis);
      await writeArtifactFile(jobId, `wireframe-highfi-${routeSlug}.json`, JSON.stringify(highFiDoc, null, 2));

      const highFiSvg = generateHighFiSVG(highFiDoc);
      await writeArtifactFile(jobId, `highfi-${routeSlug}.svg`, highFiSvg);
    }

    // Generate preview HTML
    const previewHtml = generatePreviewHTML(analysis, mode);
    await writeArtifactFile(jobId, `preview-${routeSlug}.html`, previewHtml);

    await appendLog(jobId, 'pipeline.log', `[generate] Generated wireframes for ${analysis.route}`);
  }
}

function generateLowFiDocument(jobId: string, analysis: AnalyzedRoute): WireframeDocument {
  const lowFiTree = transformToLowFi(analysis.wireframeTree);
  return {
    id: randomUUID(),
    jobId,
    route: analysis.route,
    mode: 'low-fi',
    viewport: { width: 1440, height: 900 },
    root: lowFiTree,
    createdAt: new Date().toISOString(),
  };
}

function generateHighFiDocument(jobId: string, analysis: AnalyzedRoute): WireframeDocument {
  return {
    id: randomUUID(),
    jobId,
    route: analysis.route,
    mode: 'high-fi',
    viewport: { width: 1440, height: 900 },
    root: analysis.wireframeTree,
    createdAt: new Date().toISOString(),
  };
}

function transformToLowFi(node: WireframeNode): WireframeNode {
  const result: WireframeNode = {
    ...node,
    backgroundColor: node.backgroundColor ? '#E5E7EB' : undefined,
    borderColor: node.borderColor ? '#9CA3AF' : undefined,
    children: node.children.map(transformToLowFi),
  };

  // Simplify text to line blocks
  if (result.textContent && result.textContent.length > 20) {
    result.textContent = '—'.repeat(Math.min(Math.ceil(result.textContent.length / 5), 20));
  }

  // Remove detailed colors from text
  if (result.textStyle) {
    result.textStyle = {
      ...result.textStyle,
      color: '#374151',
    };
  }

  return result;
}

function generateLowFiSVG(doc: WireframeDocument): string {
  const { width, height } = calculateDocBounds(doc.root);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  svg += `<rect width="${width}" height="${height}" fill="#F9FAFB"/>\n`;
  svg += renderNodeToSVG(doc.root, true);
  svg += '</svg>';
  return svg;
}

function generateHighFiSVG(doc: WireframeDocument): string {
  const { width, height } = calculateDocBounds(doc.root);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  svg += `<rect width="${width}" height="${height}" fill="#FFFFFF"/>\n`;
  svg += renderNodeToSVG(doc.root, false);
  svg += '</svg>';
  return svg;
}

function calculateDocBounds(root: WireframeNode): { width: number; height: number } {
  let maxWidth = root.bounds.width || 1440;
  let maxHeight = root.bounds.height || 900;

  function traverse(node: WireframeNode) {
    const right = node.bounds.x + node.bounds.width;
    const bottom = node.bounds.y + node.bounds.height;
    if (right > maxWidth) maxWidth = right;
    if (bottom > maxHeight) maxHeight = bottom;
    node.children.forEach(traverse);
  }

  traverse(root);
  return { width: Math.min(maxWidth, 2000), height: Math.min(maxHeight, 10000) };
}

function renderNodeToSVG(node: WireframeNode, isLowFi: boolean): string {
  let svg = '';
  const { x, y, width, height } = node.bounds;

  if (width < 1 || height < 1) return '';

  const fill = isLowFi
    ? getLowFiFill(node.type)
    : (node.backgroundColor || 'none');
  const stroke = isLowFi ? '#D1D5DB' : (node.borderColor || '#E5E7EB');
  const rx = node.borderRadius || 0;

  // Draw container nodes
  if (['frame', 'section', 'card', 'nav', 'sidebar', 'header', 'footer', 'modal', 'group'].includes(node.type)) {
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="1" rx="${rx}"/>\n`;
  }

  // Draw button
  if (node.type === 'button') {
    const btnFill = isLowFi ? '#9CA3AF' : (node.backgroundColor || '#3B82F6');
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${btnFill}" rx="${Math.min(rx || 6, height / 2)}" />\n`;
    if (node.textContent) {
      svg += `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" fill="${isLowFi ? '#FFFFFF' : '#FFFFFF'}" font-size="14" font-family="system-ui">${escapeXml(node.textContent.slice(0, 30))}</text>\n`;
    }
  }

  // Draw input
  if (['input', 'textarea', 'select'].includes(node.type)) {
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${isLowFi ? '#F3F4F6' : '#FFFFFF'}" stroke="${isLowFi ? '#9CA3AF' : '#D1D5DB'}" stroke-width="1" rx="${rx || 4}"/>\n`;
    if (node.placeholder || node.textContent) {
      svg += `<text x="${x + 12}" y="${y + height / 2 + 4}" fill="#9CA3AF" font-size="14" font-family="system-ui">${escapeXml((node.placeholder || node.textContent || '').slice(0, 40))}</text>\n`;
    }
  }

  // Draw image placeholder
  if (node.type === 'image-placeholder') {
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${isLowFi ? '#E5E7EB' : '#F3F4F6'}" stroke="#D1D5DB" stroke-width="1" rx="${rx}"/>\n`;
    const iconSize = Math.min(width, height, 40);
    const cx = x + width / 2;
    const cy = y + height / 2;
    svg += `<circle cx="${cx}" cy="${cy - iconSize / 6}" r="${iconSize / 4}" fill="#9CA3AF"/>\n`;
    svg += `<path d="M${cx - iconSize / 3} ${cy + iconSize / 4} L${cx} ${cy - iconSize / 8} L${cx + iconSize / 3} ${cy + iconSize / 4}" fill="#9CA3AF" opacity="0.5"/>\n`;
  }

  // Draw icon placeholder
  if (node.type === 'icon-placeholder') {
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#9CA3AF" stroke-width="1" stroke-dasharray="3,3" rx="4"/>\n`;
  }

  // Draw text nodes
  if (['text', 'heading', 'paragraph'].includes(node.type) && node.textContent) {
    const fontSize = node.textStyle?.fontSize || (node.type === 'heading' ? 24 : 14);
    const fontWeight = node.type === 'heading' ? 'bold' : 'normal';
    const color = isLowFi ? '#374151' : (node.textStyle?.color || '#111827');
    svg += `<text x="${x}" y="${y + fontSize + 2}" fill="${color}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="system-ui">${escapeXml(node.textContent.slice(0, 80))}</text>\n`;
  }

  // Draw badge
  if (node.type === 'badge') {
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${isLowFi ? '#E5E7EB' : (node.backgroundColor || '#DBEAFE')}" rx="${height / 2}"/>\n`;
    if (node.textContent) {
      svg += `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" fill="${isLowFi ? '#374151' : '#1E40AF'}" font-size="12" font-family="system-ui">${escapeXml(node.textContent.slice(0, 20))}</text>\n`;
    }
  }

  // Draw divider
  if (node.type === 'divider') {
    svg += `<line x1="${x}" y1="${y + height / 2}" x2="${x + width}" y2="${y + height / 2}" stroke="${isLowFi ? '#D1D5DB' : '#E5E7EB'}" stroke-width="1"/>\n`;
  }

  // Draw checkbox/radio
  if (node.type === 'checkbox') {
    svg += `<rect x="${x}" y="${y}" width="${Math.min(width, 18)}" height="${Math.min(height, 18)}" fill="none" stroke="#9CA3AF" stroke-width="2" rx="3"/>\n`;
  }
  if (node.type === 'radio') {
    const r = Math.min(width, height, 18) / 2;
    svg += `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="none" stroke="#9CA3AF" stroke-width="2"/>\n`;
  }

  // Recurse children
  for (const child of node.children) {
    svg += renderNodeToSVG(child, isLowFi);
  }

  return svg;
}

function getLowFiFill(type: string): string {
  switch (type) {
    case 'header': case 'nav': return '#F3F4F6';
    case 'footer': return '#F9FAFB';
    case 'sidebar': return '#F3F4F6';
    case 'card': return '#FFFFFF';
    case 'section': return '#FAFAFA';
    case 'modal': return '#FFFFFF';
    default: return 'none';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generatePreviewHTML(analysis: AnalyzedRoute, mode: WireframeMode): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframe Preview - ${escapeXml(analysis.route)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #F9FAFB; padding: 2rem; }
    .preview-container { max-width: 1440px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #111827; }
    .wireframe-frame { background: white; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <div class="preview-container">
    <h1>Route: ${escapeXml(analysis.route)}</h1>
    <div class="wireframe-frame">
      ${analysis.screenshotPath ? `<img src="${analysis.screenshotPath}" alt="Screenshot" />` : '<p>No screenshot available</p>'}
    </div>
  </div>
</body>
</html>`;
}
