import { describe, it, expect } from 'vitest';
import { FigmaExportPayloadSchema, WireframeDocumentSchema } from '@repoframe/shared';

describe('Figma export mapper', () => {
  it('should validate a minimal figma payload', () => {
    const payload = {
      version: '1.0',
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      route: '/',
      document: {
        name: 'Test',
        children: [{
          type: 'FRAME' as const,
          name: 'Root',
          x: 0,
          y: 0,
          width: 1440,
          height: 900,
        }],
      },
      exportedAt: new Date().toISOString(),
    };

    const result = FigmaExportPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should validate a wireframe document', () => {
    const doc = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      jobId: '123e4567-e89b-12d3-a456-426614174001',
      route: '/',
      mode: 'low-fi' as const,
      viewport: { width: 1440, height: 900 },
      root: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        type: 'frame' as const,
        bounds: { x: 0, y: 0, width: 1440, height: 900 },
        zIndex: 0,
        opacity: 1,
        children: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            type: 'header' as const,
            name: 'Header',
            bounds: { x: 0, y: 0, width: 1440, height: 60 },
            zIndex: 0,
            opacity: 1,
            children: [],
          },
        ],
      },
      createdAt: new Date().toISOString(),
    };

    const result = WireframeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('should reject invalid wireframe node types', () => {
    const doc = {
      id: 'test',
      jobId: 'test',
      route: '/',
      mode: 'low-fi' as const,
      viewport: { width: 1440, height: 900 },
      root: {
        id: 'test',
        type: 'invalid-type',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 0,
        opacity: 1,
        children: [],
      },
      createdAt: new Date().toISOString(),
    };

    const result = WireframeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});
