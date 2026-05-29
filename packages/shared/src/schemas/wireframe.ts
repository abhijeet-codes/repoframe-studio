import { z } from 'zod';

export const WireframeNodeType = z.enum([
  'frame',
  'section',
  'group',
  'text',
  'heading',
  'paragraph',
  'button',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'image-placeholder',
  'icon-placeholder',
  'card',
  'table',
  'row',
  'column',
  'nav',
  'sidebar',
  'header',
  'footer',
  'modal',
  'badge',
  'divider',
]);
export type WireframeNodeType = z.infer<typeof WireframeNodeType>;

export const BoundingBox = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

export const TextStyle = z.object({
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.number().optional(),
  textAlign: z.string().optional(),
  color: z.string().optional(),
});
export type TextStyle = z.infer<typeof TextStyle>;

export const LayoutInfo = z.object({
  display: z.string().optional(),
  flexDirection: z.string().optional(),
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  gap: z.number().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
});
export type LayoutInfo = z.infer<typeof LayoutInfo>;

export const WireframeNodeSchema: z.ZodType<WireframeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: WireframeNodeType,
    name: z.string().optional(),
    bounds: BoundingBox,
    zIndex: z.number().default(0),
    opacity: z.number().default(1),
    borderRadius: z.number().optional(),
    padding: z.object({
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
      left: z.number(),
    }).optional(),
    layout: LayoutInfo.optional(),
    textContent: z.string().optional(),
    textStyle: TextStyle.optional(),
    placeholder: z.string().optional(),
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
    borderWidth: z.number().optional(),
    children: z.array(WireframeNodeSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
);

export interface WireframeNode {
  id: string;
  type: WireframeNodeType;
  name?: string;
  bounds: BoundingBox;
  zIndex: number;
  opacity: number;
  borderRadius?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  layout?: LayoutInfo;
  textContent?: string;
  textStyle?: TextStyle;
  placeholder?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  children: WireframeNode[];
  metadata?: Record<string, unknown>;
}

export const WireframeDocumentSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  route: z.string(),
  mode: z.enum(['low-fi', 'high-fi']),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  root: WireframeNodeSchema,
  createdAt: z.string().datetime(),
});
export type WireframeDocument = z.infer<typeof WireframeDocumentSchema>;

export const DOMNodeSnapshotSchema: z.ZodType<DOMNodeSnapshot> = z.lazy(() =>
  z.object({
    tag: z.string(),
    role: z.string().optional(),
    ariaLabel: z.string().optional(),
    className: z.string().optional(),
    id: z.string().optional(),
    textContent: z.string().optional(),
    bounds: BoundingBox,
    computedStyles: z.record(z.string(), z.string()).optional(),
    isVisible: z.boolean(),
    children: z.array(DOMNodeSnapshotSchema).default([]),
  })
);

export interface DOMNodeSnapshot {
  tag: string;
  role?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  textContent?: string;
  bounds: BoundingBox;
  computedStyles?: Record<string, string>;
  isVisible: boolean;
  children: DOMNodeSnapshot[];
}

export const RouteAnalysisSchema = z.object({
  route: z.string(),
  url: z.string(),
  title: z.string().optional(),
  screenshotPath: z.string().optional(),
  domSnapshot: DOMNodeSnapshotSchema.optional(),
  wireframeLowFi: WireframeDocumentSchema.optional(),
  wireframeHighFi: WireframeDocumentSchema.optional(),
  error: z.string().optional(),
  renderedAt: z.string().datetime().optional(),
});
export type RouteAnalysis = z.infer<typeof RouteAnalysisSchema>;
