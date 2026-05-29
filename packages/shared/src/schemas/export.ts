import { z } from 'zod';

export const ExportFormat = z.enum([
  'wireframe-json',
  'lowfi-svg',
  'highfi-svg',
  'preview-html',
  'preview-png',
  'pdf',
  'figma-json',
  'screenshot',
  'logs',
]);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ExportArtifactSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  route: z.string().optional(),
  format: ExportFormat,
  filename: z.string(),
  path: z.string(),
  sizeBytes: z.number(),
  createdAt: z.string().datetime(),
});
export type ExportArtifact = z.infer<typeof ExportArtifactSchema>;

export const ErrorReportSchema = z.object({
  jobId: z.string(),
  stage: z.string(),
  error: z.string(),
  stack: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime(),
  remediation: z.string().optional(),
});
export type ErrorReport = z.infer<typeof ErrorReportSchema>;

export const FigmaNodeType = z.enum([
  'FRAME',
  'GROUP',
  'RECTANGLE',
  'TEXT',
  'COMPONENT',
  'INSTANCE',
  'VECTOR',
  'ELLIPSE',
]);
export type FigmaNodeType = z.infer<typeof FigmaNodeType>;

export const FigmaNodeSchema: z.ZodType<FigmaNode> = z.lazy(() =>
  z.object({
    type: FigmaNodeType,
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    fills: z.array(z.object({
      type: z.string(),
      color: z.object({
        r: z.number(),
        g: z.number(),
        b: z.number(),
        a: z.number().default(1),
      }).optional(),
    })).optional(),
    strokes: z.array(z.object({
      type: z.string(),
      color: z.object({
        r: z.number(),
        g: z.number(),
        b: z.number(),
        a: z.number().default(1),
      }).optional(),
    })).optional(),
    cornerRadius: z.number().optional(),
    characters: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    textAlignHorizontal: z.string().optional(),
    layoutMode: z.enum(['HORIZONTAL', 'VERTICAL', 'NONE']).optional(),
    primaryAxisAlignItems: z.string().optional(),
    counterAxisAlignItems: z.string().optional(),
    itemSpacing: z.number().optional(),
    paddingLeft: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingTop: z.number().optional(),
    paddingBottom: z.number().optional(),
    children: z.array(FigmaNodeSchema).optional(),
    componentId: z.string().optional(),
  })
);

export interface FigmaNode {
  type: FigmaNodeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fills?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number } }>;
  strokes?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number } }>;
  cornerRadius?: number;
  characters?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlignHorizontal?: string;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  children?: FigmaNode[];
  componentId?: string;
}

export const FigmaExportPayloadSchema = z.object({
  version: z.string().default('1.0'),
  jobId: z.string(),
  route: z.string(),
  document: z.object({
    name: z.string(),
    children: z.array(FigmaNodeSchema),
  }),
  components: z.record(z.string(), FigmaNodeSchema).optional(),
  exportedAt: z.string().datetime(),
});
export type FigmaExportPayload = z.infer<typeof FigmaExportPayloadSchema>;
