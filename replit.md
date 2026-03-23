# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via `openai` npm package (`OPENAI_API_KEY` secret); models: `gpt-4.1` (book search), `gpt-4.1-mini` (chapters, explain, chat)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── teachme/            # TeachME React frontend (Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-gemini-ai/  # Gemini AI integration
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Applications

### TeachME (`artifacts/teachme`)

A first-principles learning app. Users enter a topic, get book recommendations powered by Gemini, then drill into books chapter by chapter with AI-generated explanations.

**Features:**
- Topic → book discovery (Gemini finds 4-5 foundational books)
- Book detail with full summary + chapter list
- Streaming chapter explanations via SSE (Gemini 2.5 Flash)
- Dark sophisticated UI with Framer Motion animations

**Routes:**
- `/` — Home, topic input
- `/books` — Book discovery results for a topic
- `/books/:bookId` — Book detail with chapters
- `/books/:bookId/chapters/:chapterId` — Chapter deep dive (streaming)

### API Server (`artifacts/api-server`)

Express 5 API. Routes in `src/routes/`.

**TeachME API routes** (`/api/teachme/`):
- `POST /api/teachme/books` — find books for a topic
- `POST /api/teachme/books/:bookId/chapters` — get chapter list for a book
- `POST /api/teachme/books/:bookId/chapters/:chapterId/explain` — SSE stream chapter explanation

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Uses `@workspace/api-zod` for validation, `@workspace/db` for persistence, `@workspace/integrations-gemini-ai` for AI.

### `artifacts/teachme` (`@workspace/teachme`)

React + Vite frontend. Uses Framer Motion, Zustand, react-markdown, Tailwind CSS with Typography plugin.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Schema includes conversations + messages tables.

- `drizzle.config.ts` — Drizzle Kit config
- Dev migration: `pnpm --filter @workspace/db run push`

### `lib/integrations-gemini-ai` (`@workspace/integrations-gemini-ai`)

Gemini AI integration using Replit AI Integrations proxy. Provides pre-configured GoogleGenAI client, image generation, and batch utilities.

- Uses `AI_INTEGRATIONS_GEMINI_BASE_URL` and `AI_INTEGRATIONS_GEMINI_API_KEY` env vars (auto-provisioned)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks from the OpenAPI spec.
