import { describe, it, expect } from 'vitest';

describe('DOM classifier', () => {
  it('should classify nav elements', () => {
    const node = {
      tag: 'nav',
      bounds: { x: 0, y: 0, width: 1440, height: 60 },
      isVisible: true,
      children: [],
    };
    expect(classifyNode(node as any)).toBe('nav');
  });

  it('should classify header elements', () => {
    const node = {
      tag: 'header',
      bounds: { x: 0, y: 0, width: 1440, height: 80 },
      isVisible: true,
      children: [],
    };
    expect(classifyNode(node as any)).toBe('header');
  });

  it('should classify buttons', () => {
    const node = {
      tag: 'button',
      bounds: { x: 100, y: 100, width: 120, height: 40 },
      isVisible: true,
      children: [],
    };
    expect(classifyNode(node as any)).toBe('button');
  });

  it('should classify images as placeholders', () => {
    const node = {
      tag: 'img',
      bounds: { x: 0, y: 0, width: 300, height: 200 },
      isVisible: true,
      children: [],
    };
    expect(classifyNode(node as any)).toBe('image-placeholder');
  });

  it('should classify by class name', () => {
    const node = {
      tag: 'div',
      className: 'card-container',
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      isVisible: true,
      children: [{ tag: 'p', bounds: { x: 0, y: 0, width: 100, height: 20 }, isVisible: true, children: [] }],
    };
    expect(classifyNode(node as any)).toBe('card');
  });

  it('should skip invisible nodes', () => {
    const node = {
      tag: 'div',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      isVisible: false,
      children: [],
    };
    expect(shouldSkipNode(node as any)).toBe(true);
  });

  it('should skip tiny nodes', () => {
    const node = {
      tag: 'div',
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      isVisible: true,
      children: [],
    };
    expect(shouldSkipNode(node as any)).toBe(true);
  });

  it('should merge single-child wrapper divs', () => {
    const node = {
      tag: 'div',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      isVisible: true,
      children: [{ tag: 'p', bounds: { x: 0, y: 0, width: 100, height: 20 }, isVisible: true, children: [] }],
    };
    expect(shouldMergeWrapper(node as any)).toBe(true);
  });

  it('should not merge divs with semantic classes', () => {
    const node = {
      tag: 'div',
      className: 'navigation-bar',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      isVisible: true,
      children: [{ tag: 'p', bounds: { x: 0, y: 0, width: 100, height: 20 }, isVisible: true, children: [] }],
    };
    expect(shouldMergeWrapper(node as any)).toBe(false);
  });
});

// Import the functions we're testing (they need to be exported)
import { DOMNodeSnapshot, WireframeNodeType } from '@repoframe/shared';

function classifyNode(node: DOMNodeSnapshot): WireframeNodeType {
  const tag = node.tag;
  const role = (node as any).role;
  const className = ((node as any).className || '').toLowerCase();

  if (tag === 'nav' || role === 'navigation') return 'nav';
  if (tag === 'header' || role === 'banner') return 'header';
  if (tag === 'footer' || role === 'contentinfo') return 'footer';
  if (tag === 'aside' || role === 'complementary') return 'sidebar';
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

  if (className.includes('card') || className.includes('tile')) return 'card';
  if (className.includes('modal') || className.includes('dialog') || role === 'dialog') return 'modal';
  if (className.includes('badge') || className.includes('tag') || className.includes('chip')) return 'badge';
  if (className.includes('nav') || className.includes('menu')) return 'nav';
  if (className.includes('sidebar')) return 'sidebar';
  if (className.includes('header') || className.includes('topbar')) return 'header';
  if (className.includes('footer')) return 'footer';
  if (className.includes('icon')) return 'icon-placeholder';
  if (className.includes('btn') || className.includes('button')) return 'button';

  if (node.children.length > 0) {
    if (node.bounds.width > 800 && node.bounds.height > 200) return 'section';
    return 'group';
  }

  if ((node as any).textContent) return 'text';
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
  if ((node as any).role || (node as any).ariaLabel) return false;
  if ((node as any).id) return false;
  const className = ((node as any).className || '').toLowerCase();
  if (className.includes('card') || className.includes('nav') || className.includes('header') ||
      className.includes('footer') || className.includes('sidebar') || className.includes('modal') ||
      className.includes('btn') || className.includes('button')) return false;
  return true;
}
