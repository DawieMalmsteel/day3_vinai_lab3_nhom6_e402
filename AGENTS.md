# AGENTS.md — AI Travel Agent Chatbot

**Single-page React 19 + TypeScript chatbot for travel planning via Gemini 2.0 Flash API.**

## Quick Start

```bash
npm install                    # Install deps (Vite will auto-load from package.json)
npm run dev                    # Dev server at http://0.0.0.0:3000 with HMR
npm run lint                   # TypeScript check (only verification available)
npm run build                  # Production bundle to dist/
```

**Critical:** Set `GEMINI_API_KEY` env var before dev or build. Required at runtime.

## Common Gotchas

- **No test runner configured.** TypeScript strict mode is the quality gate. Changes must pass `npm run lint`.
- **Gemini API rate limits:** Free tier quota exhausts quickly. Use exponential backoff (see `gemini.ts` retry logic).
- **System prompt is critical.** Changes to `systemInstruction` in `gemini.ts:103-160` directly affect all model responses. Always include warm greeting section, scope limits, and response rules.
- **Dev server must use `--host=0.0.0.0`** for HMR to work correctly (hardcoded in `vite.config.ts`).
- **CORS proxy:** External web fetches use `api.allorigins.win` to bypass CORS. Travel guides served locally from `/public/data/guides/*.md`.
- **Single component state:** All chat state lives in `App.tsx`. Booking/hotel flows are multistep within the same component (no routing).

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
- **Logging**: Use `debug.log()`, `debug.success()`, `debug.error()` with context
- **User messages**: Return friendly Vietnamese strings, never raw stack traces
- **Retries**: Exponential backoff for 429 (rate limit) & 5xx errors (max 3 retries)
- Example: Check `gemini.ts:136-150` for retry logic pattern

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

### System Prompt Structure (gemini.ts:104-160)
The system prompt is **critical** for correct behavior. It has 8 sections (do not skip or merge):
1. **Greeting section** - Warm greeting, ask needs, DO NOT dump scope list immediately
2. **Scope (4 topics)** - ✈️ Flights, 🚌 Buses, 🏨 Hotels, 📍 Travel guides
3. **Out-of-scope rejection** - Polite redirect (NOT curt), suggest travel alternatives
4. **Response rules** - 5 rules: concise, markdown links, structure, follow-up questions, avoid verbosity
5. **Booking resources** - 4 URL templates (Booking.com, Agoda, Vietjet, Vietnam Airlines)
6. **Language & format** - Vietnamese only, Markdown, emojis, no HTML
7. **Examples** - 3 detailed examples (greeting, in-scope, out-of-scope)
8. **Things to avoid** - What NOT to do

See `BEFORE_AFTER_COMPARISON.md` for tone improvements made in latest commit.

### Topic Validation (contentFilter.ts)
All messages checked via `isValidTopic()` before processing:
- **Allowed**: flights, buses, hotels, travel guides (Đà Nẵng, Đà Lạt, Phú Quốc)
- **Blocked**: restaurants, weather, sports, movies, work, relationships, etc.
- **Response**: `getOutOfScopeMessage()` returns polite, helpful rejection (see system prompt)

### Booking Flow (App.tsx:65-119)
Multi-step conversational flow in `App.tsx`:
1. `detectRoute()` finds "từ X đến Y" patterns in user message
2. Bot asks: "Flight or bus?"
3. User selects transport method via `parseTransport()`
4. Bot asks: "How many passengers?"
5. `parsePassengerCount()` extracts number
6. `searchBookingLinks()` calls Gemini to generate markdown links
7. Results displayed as: `[Provider](URL)`

**State managed in App.tsx** - no separate routing or state management library.

### Hotel Search (hotelService.ts)
3 search options (user picks A/B/C):
- **A) Quick**: 2-3 top hotels with links
- **B) Smart**: Ask location → filter → suggest
- **C) Detailed**: Full search form with price/location/type

Hotel data is mock/simulated; returns formatted results based on selected type.

### Debug Logging (debug.ts)
Use color-coded logging with structure:
```typescript
debug.group('Operation name');
debug.log('MODULE', 'Message', data);      // Info
debug.success('MODULE', 'Success message'); // Success
debug.error('MODULE', 'Error message', err); // Error
debug.warn('MODULE', 'Warning message');    // Warning
debug.groupEnd();
```
**DO NOT mix debug.log() with console.log()** - use debug module for consistency.

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
