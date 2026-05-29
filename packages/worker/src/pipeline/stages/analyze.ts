import { DOMNodeSnapshot, WireframeNode, WireframeNodeType } from '@repoframe/shared';
import { appendLog } from '../context.js';
import { randomUUID } from 'node:crypto';

interface RenderedRoute {
  route: string;
  url: string;
  screenshotPath?: string;
  domSnapshot?: DOMNodeSnapshot;
  error?: string;
}

interface AnalyzedRoute {
  route: string;
  url: string;
  screenshotPath?: string;
  wireframeTree: WireframeNode;
  error?: string;
}

export async function analyzeDOM(jobId: string, renderedRoutes: RenderedRoute[]): Promise<AnalyzedRoute[]> {
  const results: AnalyzedRoute[] = [];

  for (const rendered of renderedRoutes) {
    if (!rendered.domSnapshot) {
      if (rendered.error) {
        results.push({
          route: rendered.route,
          url: rendered.url,
          screenshotPath: rendered.screenshotPath,
          wireframeTree: createEmptyFrame(rendered.route),
          error: rendered.error,
        });
      }
      continue;
    }

    try {
      const wireframeTree = transformDOMToWireframe(rendered.domSnapshot);
      results.push({
        route: rendered.route,
        url: rendered.url,
        screenshotPath: rendered.screenshotPath,
        wireframeTree,
      });
      await appendLog(jobId, 'parser.log', `[analyze] ${rendered.route}: transformed successfully`);
    } catch (err: any) {
      await appendLog(jobId, 'parser.log', `[analyze] ${rendered.route}: ERROR ${err.message}`);
      results.push({
        route: rendered.route,
        url: rendered.url,
        screenshotPath: rendered.screenshotPath,
        wireframeTree: createEmptyFrame(rendered.route),
        error: err.message,
      });
    }
  }

  return results;
}

function createEmptyFrame(route: string): WireframeNode {
  return {
    id: randomUUID(),
    type: 'frame',
    name: route,
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    zIndex: 0,
    opacity: 1,
    children: [],
  };
}

function transformDOMToWireframe(dom: DOMNodeSnapshot): WireframeNode {
  return traverseAndClassify(dom, 0);
}

function traverseAndClassify(node: DOMNodeSnapshot, depth: number): WireframeNode {
  const type = classifyNode(node);
  const children: WireframeNode[] = [];

  // Process children, merging wrapper divs
  for (const child of node.children) {
    if (shouldSkipNode(child)) continue;

    if (shouldMergeWrapper(child)) {
      // Flatten single-child wrappers with no semantic value
      for (const grandchild of child.children) {
        if (!shouldSkipNode(grandchild)) {
          children.push(traverseAndClassify(grandchild, depth + 1));
        }
      }
    } else {
      children.push(traverseAndClassify(child, depth + 1));
    }
  }

  const wireframeNode: WireframeNode = {
    id: randomUUID(),
    type,
    name: inferName(node, type),
    bounds: node.bounds,
    zIndex: parseInt(node.computedStyles?.zIndex || '0') || 0,
    opacity: 1,
    children,
  };

  // Add text content
  if (node.textContent) {
    wireframeNode.textContent = node.textContent;
  }

  // Add text styles
  if (node.computedStyles?.fontSize || node.computedStyles?.fontWeight) {
    wireframeNode.textStyle = {
      fontSize: parseFloat(node.computedStyles?.fontSize || '16'),
      fontWeight: node.computedStyles?.fontWeight,
      color: node.computedStyles?.color,
    };
  }

  // Add layout info
  if (node.computedStyles?.display === 'flex' || node.computedStyles?.display === 'grid') {
    wireframeNode.layout = {
      display: node.computedStyles.display,
      flexDirection: node.computedStyles.flexDirection,
      justifyContent: node.computedStyles.justifyContent,
      alignItems: node.computedStyles.alignItems,
      gap: parseFloat(node.computedStyles.gap || '0') || undefined,
    };
  }

  // Add border radius
  if (node.computedStyles?.borderRadius) {
    const radius = parseFloat(node.computedStyles.borderRadius);
    if (radius > 0) wireframeNode.borderRadius = radius;
  }

  // Add padding
  if (node.computedStyles?.padding) {
    const parts = node.computedStyles.padding.split(' ').map(p => parseFloat(p) || 0);
    if (parts.some(p => p > 0)) {
      wireframeNode.padding = {
        top: parts[0] || 0,
        right: parts[1] || parts[0] || 0,
        bottom: parts[2] || parts[0] || 0,
        left: parts[3] || parts[1] || parts[0] || 0,
      };
    }
  }

  // Add background color
  if (node.computedStyles?.backgroundColor && node.computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    wireframeNode.backgroundColor = node.computedStyles.backgroundColor;
  }

  return wireframeNode;
}

function classifyNode(node: DOMNodeSnapshot): WireframeNodeType {
  const tag = node.tag;
  const role = node.role;
  const className = (node.className || '').toLowerCase();

  // Direct tag mappings
  if (tag === 'nav' || role === 'navigation') return 'nav';
  if (tag === 'header' || role === 'banner') return 'header';
  if (tag === 'footer' || role === 'contentinfo') return 'footer';
  if (tag === 'aside' || role === 'complementary') {
    if (className.includes('sidebar')) return 'sidebar';
    return 'sidebar';
  }
  if (tag === 'main' || role === 'main') return 'section';
  if (tag === 'section') return 'section';
  if (tag === 'article') return 'card';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
  if (tag === 'p') return 'paragraph';
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'input') return 'input';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  if (tag === 'img' || tag === 'svg' || tag === 'picture') return 'image-placeholder';
  if (tag === 'table') return 'table';
  if (tag === 'tr') return 'row';
  if (tag === 'td' || tag === 'th') return 'column';
  if (tag === 'hr') return 'divider';
  if (tag === 'form') return 'group';

  // Class-based heuristics
  if (className.includes('card') || className.includes('tile')) return 'card';
  if (className.includes('modal') || className.includes('dialog') || role === 'dialog') return 'modal';
  if (className.includes('badge') || className.includes('tag') || className.includes('chip')) return 'badge';
  if (className.includes('nav') || className.includes('menu')) return 'nav';
  if (className.includes('sidebar')) return 'sidebar';
  if (className.includes('header') || className.includes('topbar')) return 'header';
  if (className.includes('footer')) return 'footer';
  if (className.includes('icon')) return 'icon-placeholder';
  if (className.includes('btn') || className.includes('button')) return 'button';
  if (className.includes('input') || className.includes('field')) return 'input';

  // Checkbox/radio detection
  if (tag === 'input') {
    const typeAttr = node.computedStyles?.['type'];
    if (typeAttr === 'checkbox') return 'checkbox';
    if (typeAttr === 'radio') return 'radio';
  }

  // Structural grouping
  if (node.children.length > 0) {
    if (node.bounds.width > 800 && node.bounds.height > 200) return 'section';
    return 'group';
  }

  if (node.textContent) return 'text';
  return 'group';
}

function shouldSkipNode(node: DOMNodeSnapshot): boolean {
  if (!node.isVisible) return true;
  if (node.bounds.width < 2 || node.bounds.height < 2) return true;
  if (node.tag === 'script' || node.tag === 'style' || node.tag === 'link' || node.tag === 'meta') return true;
  return false;
}

function shouldMergeWrapper(node: DOMNodeSnapshot): boolean {
  if (node.children.length !== 1) return false;
  if (node.tag !== 'div' && node.tag !== 'span') return false;
  if (node.role || node.ariaLabel) return false;
  if (node.id) return false;
  const className = (node.className || '').toLowerCase();
  if (className.includes('card') || className.includes('nav') || className.includes('header') ||
      className.includes('footer') || className.includes('sidebar') || className.includes('modal') ||
      className.includes('btn') || className.includes('button')) return false;
  return true;
}

function inferName(node: DOMNodeSnapshot, type: WireframeNodeType): string {
  if (node.ariaLabel) return node.ariaLabel.slice(0, 50);
  if (node.id) return node.id;
  if (node.textContent && node.textContent.length < 30) return node.textContent;
  return type;
}
