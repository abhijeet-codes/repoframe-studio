# RepoFrame Studio

Generate editable wireframes from any GitHub repository or ZIP upload. RepoFrame clones, builds, renders, and extracts structured wireframes ready for design tools.

## Architecture

```
repoframe-studio/
├── packages/
│   ├── shared/       # Zod schemas, types (Job, Wireframe, Export, Figma)
│   ├── backend/      # Fastify API server, job management, file storage
│   ├── worker/       # Pipeline runner, Playwright renderer, DOM analyzer
│   └── frontend/     # React + Vite + Tailwind UI
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

### Pipeline

1. **Clone/Extract** — Git clone or ZIP extraction into isolated workspace
2. **Detect** — Identify package manager, framework, entry points
3. **Install** — Run dependency install with timeout
4. **Build** — Execute build command with captured logs
5. **Discover** — Find routes (file-based, react-router patterns, static HTML)
6. **Render** — Launch app, navigate routes with Playwright
7. **Analyze** — Extract DOM tree, classify components, compute bounding boxes
8. **Generate** — Produce low-fi and high-fi wireframe documents + SVG
9. **Export** — Generate Figma-compatible JSON, screenshots, logs

### Wireframe Modes

- **Low-fi**: Grayscale, simplified text, image placeholders, layout-focused
- **High-fi**: Preserves real text, colors, component styles, semantic mapping

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Git (for GitHub cloning)
- Playwright browsers: `npx playwright install chromium`

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Build shared schemas
pnpm --filter @repoframe/shared build

# Start development (all services)
pnpm dev
```

This starts:
- **Backend** at http://localhost:3001
- **Frontend** at http://localhost:5173

### Individual Services

```bash
pnpm dev:backend   # API server only
pnpm dev:frontend  # UI only (proxies to backend)
pnpm dev:worker    # Worker only (usually spawned by backend)
```

### Build

```bash
pnpm build         # Build all packages
```

### Test

```bash
pnpm test          # Run all tests
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/jobs` | Create job (GitHub) |
| `POST` | `/api/upload/zip` | Create job (ZIP upload) |
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/:id` | Get job details |
| `DELETE` | `/api/jobs/:id` | Delete job |
| `POST` | `/api/jobs/:id/retry/:stage` | Retry from failed stage |
| `GET` | `/api/artifacts/:jobId` | List artifacts |
| `GET` | `/api/artifacts/:jobId/:filename` | Download artifact |
| `GET` | `/api/logs/:jobId` | Get all logs |
| `GET` | `/api/logs/:jobId/:logName` | Get specific log |

## Figma Integration

RepoFrame generates `figma-export-*.json` files compatible with Figma plugin import:

```json
{
  "version": "1.0",
  "document": {
    "name": "RepoFrame - /",
    "children": [{ "type": "FRAME", "layoutMode": "VERTICAL", ... }]
  },
  "components": {
    "button-Submit": { "type": "COMPONENT", ... },
    "card-default": { "type": "COMPONENT", ... }
  }
}
```

Integration methods:
1. **JSON Export** — Download and import via plugin (available now)
2. **Plugin Adapter** — Companion Figma plugin reads the payload
3. **MCP Adapter** — Model Context Protocol for AI-assisted design

## Security

- All repository execution is sandboxed in isolated workspace directories
- CPU, memory, file size, and timeout limits enforced
- No arbitrary shell command execution from user input
- Filenames and paths sanitized on upload
- Zip-slip prevention on extraction
- Directory traversal protection on artifact serving
- Secrets redacted in logs
- Host paths never exposed in UI

## Data Storage

MVP uses local filesystem storage:
- `./data/jobs/` — Job metadata JSON files
- `./data/workspaces/` — Cloned/extracted project files
- `./data/artifacts/` — Generated wireframes, screenshots, exports, logs

## Environment Variables

See [.env.example](.env.example) for all configuration options.

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, TanStack Query, React Router, Lucide Icons
- **Backend**: Fastify, Zod validation, Multipart upload
- **Worker**: Playwright, child_process isolation
- **Shared**: Zod schemas, TypeScript types
- **Package Manager**: pnpm workspaces
