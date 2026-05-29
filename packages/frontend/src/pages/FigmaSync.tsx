import { Figma, Info, ExternalLink } from 'lucide-react';

export function FigmaSyncPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Figma Sync</h1>

      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <Figma className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium">Figma Export</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Export wireframes as Figma-compatible JSON</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--color-info)] mt-0.5 shrink-0" />
            <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
              <p>RepoFrame generates Figma-compatible JSON payloads for each wireframe.</p>
              <p>The export includes:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Frames with auto-layout</li>
                <li>Text nodes with font properties</li>
                <li>Rectangles with fills and strokes</li>
                <li>Component templates (buttons, cards, inputs)</li>
                <li>Proper nesting and grouping</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium">Integration Methods</h2>
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-medium">1. JSON Export (Available)</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Download figma-export.json from the Export Center and import via Figma plugin.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-medium">2. Figma Plugin (Planned)</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              A companion Figma plugin that reads the JSON payload and creates the design directly.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-medium">3. MCP Adapter (Planned)</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Model Context Protocol adapter for AI-assisted Figma design from wireframe data.
            </p>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-medium">Figma Export Format</h2>
        <pre className="text-xs font-mono p-3 rounded-lg bg-[var(--color-bg-secondary)] overflow-x-auto">
{`{
  "version": "1.0",
  "jobId": "uuid",
  "route": "/",
  "document": {
    "name": "RepoFrame - /",
    "children": [
      {
        "type": "FRAME",
        "name": "Root",
        "layoutMode": "VERTICAL",
        "children": [...]
      }
    ]
  },
  "components": {
    "button-Submit": { ... },
    "card-default": { ... }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
