# AGENTS.md — AI Travel Agent

## Project Overview

React + TypeScript + Vite frontend app. AI-powered travel agent chatbot using Google Gemini (`@google/genai`). Tailwind CSS v4 for styling. No test framework configured.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 (0.0.0.0) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove `dist/` |
| `npm run lint` | Type-check only (`tsc --noEmit`) |

No test runner or linter (eslint/prettier) is configured. TypeScript is the sole quality gate.

## Architecture

```
src/
  App.tsx              # Main chat UI, ReAct agent loop
  index.css            # Tailwind + markdown styles
  main.tsx             # Entry point
  types.ts             # Interfaces (Message, Flight, Hotel, DistanceInfo)
  services/
    gemini.ts          # Gemini AI service + tool implementations
public/data/guides/    # Markdown travel guides (dalat, danang, phuquoc)
```

### Agent Loop (App.tsx)

1. `chatWithTravelAgent()` sends messages to Gemini
2. `handleToolCalls()` executes any function calls
3. While tool results exist: push results to history, re-call model
4. Extract final text + grounding metadata sources for display

## Code Style

### Imports
- Group imports: libraries first, then local (`./` or `../`)
- Use named imports exclusively (no default exports except React components)
- Path alias `@/*` maps to project root (e.g., `@/services/gemini`)

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays
- Max line length: no hard limit, but keep readable

### Types
- Strict TypeScript mode (no implicit any)
- Use `as any` sparingly — only for Gemini SDK response args
- Prefer explicit return types on exported functions
- Interfaces for public types, `type` for unions/intersections

### Naming
- Components: PascalCase (`App`, `ChatMessage`)
- Functions/variables: camelCase (`chatWithTravelAgent`, `handleToolCalls`)
- Constants: UPPER_SNAKE_CASE (`GUIDES`, `MAX_RETRIES`)
- Files: camelCase (`gemini.ts`, `types.ts`)

### Error Handling
- Try/catch around all async external calls (fetch, Gemini API)
- Log errors with `console.error` + context message
- Return user-friendly Vietnamese error strings, never raw stack traces
- Exponential backoff retry (3 max) for rate limits (429) and transient errors (500/503)

### React Conventions
- Functional components only, hooks for state
- `useState` for local state, `useRef` for DOM refs, `useEffect` for side effects
- Use `clsx` + `tailwind-merge` (`cn()` utility) for conditional classes
- No class components, no Redux — keep state local to App.tsx

### Environment
- `GEMINI_API_KEY` injected at build time via `vite.config.ts` `define`
- `.env` files are gitignored (except `.env.example`)
- Never commit real API keys

### CORS
- Frontend uses `api.allorigins.win` proxy for external URL fetching
- Internal guides served from `/public/data/guides/` (no CORS issue)
