# AGENTS.md — AI Travel Agent

## Project Overview

React 19 + TypeScript 5.8 + Vite frontend chatbot for travel planning. AI-powered using Google Gemini API (`@google/genai`). Tailwind CSS v4 for styling. Scoped to: flights, buses, hotels, and travel guides only.

## Build & Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on `http://0.0.0.0:3000` with HMR |
| `npm run build` | Production build to `dist/` (Vite) |
| `npm run preview` | Preview production build locally |
| `npm run clean` | Remove `dist/` directory |
| `npm run lint` | TypeScript type-check only (`tsc --noEmit`) |

**No test runner or linter configured.** TypeScript strict mode is the quality gate. Manual testing required.

## Architecture

```
src/
  App.tsx                 # Main chat UI & message flow
  main.tsx                # React entry point
  index.css               # Tailwind + markdown styles
  types.ts                # TypeScript interfaces (Message, BookingOption, HotelOption, etc.)
  utils/
    debug.ts              # Color-coded logging system
  services/
    gemini.ts             # Gemini API integration, chat logic
    bookingService.ts     # Flight/bus route detection & booking flow
    hotelService.ts       # Hotel search with 3 format options (A/B/C)
    contentFilter.ts      # Topic validation (only flights/buses/hotels/travel guides)
public/
  data/guides/            # Markdown travel guides (dalat.md, danang.md, phuquoc.md)
```

## Code Style

### Imports
- **Order**: Libraries → local relative imports (`./` or `../`)
- **Style**: Named imports only (no default exports except React components)
- **Aliases**: `@/*` maps to project root via tsconfig
- Example: `import { detectRoute } from './services/bookingService'`

### Formatting
- **Indentation**: 2 spaces (enforce via editor)
- **Strings**: Single quotes (`'hello'`), not double
- **Semicolons**: Always required
- **Trailing commas**: Multi-line objects/arrays must have trailing comma
- **Line length**: No hard limit, but keep readable (<100 chars preferred)

### Types
- **Mode**: Strict TypeScript (no implicit `any`)
- **Casting**: Avoid `as any`; use proper type annotations
- **Return types**: Explicit on all exported functions
- **Interface vs type**: Interfaces for object shapes, `type` for unions/aliases
- Example: `export const detectRoute = (msg: string): RouteDetection => { ... }`

### Naming Conventions
- **Components**: PascalCase (`App`, `ChatMessage`, `HotelSearch`)
- **Functions/vars**: camelCase (`handleSend`, `isValidTopic`, `formatBookingOptions`)
- **Constants**: UPPER_SNAKE_CASE (`ALLOWED_TOPICS`, `MAX_RETRIES`, `VIETNAM_CITIES`)
- **Files**: camelCase (`contentFilter.ts`, `bookingService.ts`)

### Error Handling
- **Try/catch**: Wrap all async external calls (fetch, API, file I/O)
- **Logging**: Use `debug.error()` or `console.error()` with context
- **User messages**: Return friendly Vietnamese strings, never raw stack traces
- **Retries**: Exponential backoff for 429 (rate limit) & 5xx errors (max 3 retries)
- Example: Check `gemini.ts` for retry logic pattern

### React Patterns
- **Components**: Functional only (no class components)
- **Hooks**: `useState` for state, `useRef` for DOM refs, `useEffect` for side effects
- **Styling**: Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- **State**: Keep local to component; no Redux or global state except booking/hotel flows
- Example: `className={cn("base", isLoading && "opacity-50")}`

### Environment & Config
- **API Key**: `GEMINI_API_KEY` injected at build time via `vite.config.ts` → `process.env`
- **Env files**: `.env` is gitignored; check `.env.example` for required vars
- **Never commit**: Real API keys, secrets, or credentials
- **CORS**: Use `api.allorigins.win` proxy for external web fetches; guides served from `/public/data/guides/`

## Key Implementation Details

### Topic Validation
All messages checked via `isValidTopic()` in `contentFilter.ts` before processing:
- **Allowed**: flights, buses, hotels, travel guides (Đà Nẵng, Đà Lạt, Phú Quốc)
- **Blocked**: restaurants, weather, sports, movies, work, relationships, etc.
- **Response**: `getOutOfScopeMessage()` redirects to allowed topics

### Booking Flow
1. `detectRoute()` finds "từ X đến Y" patterns
2. User selects transport (flight/bus)
3. User enters passenger count
4. `searchBookingLinks()` generates booking URLs via Gemini
5. Results displayed in markdown format: `[Provider](URL)`

### Hotel Search (3 Options)
- **A) Quick**: 2-3 hotels with links
- **B) Smart**: Ask location → filter → suggest
- **C) Detailed**: Full search form with price/location/type filters

### Debug Logging
Use `debug.log()`, `debug.success()`, `debug.error()` with color-coded output:
```typescript
debug.group('Operation name');
debug.log('MODULE', 'Message', data);
debug.success('MODULE', 'Success message');
debug.groupEnd();
```

## TypeScript Config
- **Target**: ES2022
- **Module**: ESNext
- **JSX**: react-jsx (React 19 automatic runtime)
- **Paths**: `@/*` → `./*` (project root)
- **Strict mode**: Enforced (no implicit any, nullish checks required)

## Deployment
- Build: `npm run build` generates minified bundle in `dist/`
- Vite handles tree-shaking and code-splitting
- Deploy `dist/` folder to static host (Vercel, Netlify, etc.)
- Ensure `GEMINI_API_KEY` is set in production environment
