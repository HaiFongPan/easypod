# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyPod is a privacy-first desktop podcast player built with Electron, React, and TypeScript. It features local audio transcription (FunASR), AI-powered summaries, and exports to Markdown/Obsidian. The app is currently in MVP development targeting macOS.

## Development Commands

### Development
```bash
npm run dev                    # Start concurrent dev servers (main + renderer)
npm run dev:main              # Build and run Electron main process in dev mode
npm run dev:renderer          # Start Vite dev server (runs on localhost:5173)
```

### Building
```bash
npm run build                 # Build both main and renderer processes
npm run build:main           # Build main process TypeScript
npm run build:renderer       # Build renderer process with Vite
```

### Testing
```bash
npm test                      # Run Jest tests
npm run type-check           # TypeScript type checking without emitting files
```

### Packaging
```bash
npm run dist                  # Build and create distributable package
npm run dist:mac             # Build macOS distributable
npm run pack                 # Build and package without distribution
```

### Code Quality
```bash
npm run lint                  # Run ESLint
npm run lint:fix             # Fix auto-fixable ESLint issues
```

## Architecture

### Process Structure

**Electron Main Process** (`src/main/`)
- System integration, window management, IPC coordination
- Entry point: `src/main/main.ts`
- Database initialization and management (SQLite + Drizzle ORM)
- RSS feed parsing and subscription management (`FeedParser`, `FeedIPCHandlers`)

**Renderer Process** (`src/renderer/`)
- React UI components, user interactions, audio playback
- Entry point: `src/renderer/main.tsx`
- State management via Zustand (stores in `src/renderer/store/`)
- Audio player implemented using HTMLAudioElement

**IPC Bridge** (`src/main/preload.ts`)
- Exposes secure API to renderer via `window.electronAPI`
- All main-renderer communication must go through preload script
- API defined with TypeScript types (`ElectronAPI` interface)

### Database Schema

SQLite database managed via Drizzle ORM (`src/main/database/schema.ts`):

**Core Tables:**
- `feeds` - Podcast subscriptions (RSS sources)
- `episodes` - Individual podcast episodes with playback state
- `chapters` - Episode chapters from various sources (JSON, ID3, shownotes)
- `transcripts` - Transcription metadata and paths
- `transcriptSegments` - Individual transcript segments with timestamps
- `aiTasks` - AI processing tasks and results
- `aiPrompts` - Prompt templates for AI operations
- `aiProviders` - Configured AI service providers
- `exportTasks` - Export task tracking
- `settings` - Application settings
- `searchIndex` - FTS5 full-text search index

**Key Relationships:**
- feeds → episodes (1:many, cascade delete)
- episodes → chapters/transcripts/aiTasks/exportTasks (1:many, cascade delete)
- transcripts → transcriptSegments (1:many, cascade delete)

### State Management

Zustand stores in `src/renderer/store/`:
- `playerStore` - Audio playback state, controls, current episode
- `episodesStore` - Episode data, loading states
- `subscriptionStore` - Feed subscriptions, refresh operations
- `settingsStore` - User preferences (volume, playback rate, skip intervals)
- `navigationStore` - UI navigation state
- `appStore` - Global app state

### RSS Feed Parsing

`FeedParser` service (`src/main/services/FeedParser.ts`):
- Supports RSS 2.0, iTunes extensions, Podcast 2.0 standards
- Built-in caching with ETags and conditional requests (`FeedCache`)
- Retry mechanism with exponential backoff
- Chapter extraction from JSON, shownotes, and ID3 tags
- Comprehensive field normalization and validation

### IPC Communication

All IPC handlers registered in `FeedIPCHandlers` (`src/main/services/IPCHandlers.ts`):

**Feed Operations:**
- `feeds:subscribe` - Add new RSS subscription
- `feeds:unsubscribe` - Remove subscription
- `feeds:getAll` - List all subscribed feeds
- `feeds:refresh` - Update specific feed
- `feeds:refreshAll` - Update all feeds
- `feeds:validate` - Validate feed URL without subscribing

**Episode Operations:**
- `episodes:getAll` - Fetch episodes (with filters)
- `episodes:getByFeed` - Get episodes for specific feed
- `episodes:updateProgress` - Save playback position
- `episodes:markAsPlayed` / `markAsNew` - Update episode status
- `episodes:search` - Full-text episode search

### TypeScript Configuration

- Main process: `src/main/tsconfig.json` (Node.js target)
- Renderer process: Root `tsconfig.json` (DOM, React JSX)
- Path alias: `@/*` maps to `src/renderer/*`

## Development Guidelines

### Adding New IPC Handlers

1. Register handler in `FeedIPCHandlers` constructor
2. Add handler method (prefix with `handle`)
3. Update `preload.ts` to expose handler to renderer
4. Update `ElectronAPI` interface with types
5. Add cleanup in `FeedIPCHandlers.destroy()`

### Database Migrations

- Schema defined in `src/main/database/schema.ts`
- Use Drizzle ORM for schema changes
- Database initialized in `src/main/main.ts` on app startup
- Connection managed via `getDatabaseManager()` singleton

### Audio Player Integration

- Audio element managed in `playerStore.audioRef`
- Set audio ref before loading episodes (`setAudioRef`)
- Playback state persisted via `usePlaybackPersistence` hook
- Progress auto-saves to database every 5 seconds

### Testing

- Test files located in `src/__tests__/`
- Jest configuration: `jest.config.js`
- Fixtures for RSS feeds: `src/__tests__/fixtures/sampleRss.ts`
- Mock external dependencies (axios, electron)

### File Structure Conventions

```
src/
├── main/                      # Electron main process
│   ├── database/             # Database schema, DAOs, connection
│   │   ├── dao/             # Data access objects (CRUD operations)
│   │   ├── schema.ts        # Drizzle ORM schema
│   │   └── connection.ts    # Database singleton
│   ├── services/            # Business logic, feed parser, IPC handlers
│   ├── utils/               # Utility functions (feedNormalizer)
│   ├── types/               # TypeScript type definitions
│   ├── main.ts             # Main process entry point
│   └── preload.ts          # IPC bridge
└── renderer/                 # React renderer process
    ├── components/          # React components (Button, AudioPlayer, etc.)
    ├── pages/              # Page components
    ├── store/              # Zustand stores
    ├── hooks/              # Custom React hooks
    ├── utils/              # Renderer utilities
    ├── types/              # Renderer type definitions
    └── main.tsx            # Renderer entry point
```

## Key Implementation Details

### Feed Subscription Flow

1. User provides RSS URL in `AddFeedDialog`
2. Renderer calls `window.electronAPI.feeds.validate(url)`
3. Main process fetches and parses feed via `FeedParser`
4. On success, `feeds:subscribe` creates feed + episodes in database
5. Episodes automatically get feed cover art as fallback

### Episode Playback Flow

1. User clicks episode → calls `playerStore.loadAndPlay(episode)`
2. Store updates state and loads audio URL into `HTMLAudioElement`
3. Audio element events update store (timeupdate, ended, error)
4. `usePlaybackPersistence` hook auto-saves progress every 5s
5. Progress saved via `episodes:updateProgress` IPC call

### Caching Strategy

- Feed responses cached with ETags/Last-Modified headers
- Cache TTL: 30 minutes (configurable)
- Conditional requests avoid redundant downloads
- Cache stats available via `feeds:getCacheStats`

## Common Patterns

### Zustand Store Pattern
```typescript
export const useMyStore = create<MyStore>()(
  devtools(
    (set, get) => ({
      // State
      value: 0,
      // Actions
      setValue: (val) => set({ value: val }),
    }),
    { name: 'My Store' }
  )
);
```

### IPC Handler Pattern
```typescript
private async handleOperation(
  event: IpcMainInvokeEvent,
  params: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Operation logic
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Operation failed',
    };
  }
}
```

### DAO Pattern
```typescript
export class MyDao {
  private db = getDatabaseManager().getDatabase();

  async findAll() {
    return this.db.select().from(table).all();
  }

  async findById(id: number) {
    return this.db.select().from(table).where(eq(table.id, id)).get();
  }
}
```

## Current Development Status

Based on `docs/plan.md`, the project is in Stage 2-3 of 5:
- ✅ Stage 1: Core infrastructure (Electron, React, SQLite, audio player)
- ✅ Stage 2: RSS subscription and playback (in progress)
- ⏳ Stage 3: FunASR transcription integration (upcoming)
- ⏳ Stage 4: AI summaries and analysis (upcoming)
- ⏳ Stage 5: Obsidian export and DMG packaging (upcoming)

## Known Constraints

- macOS only (no Windows/Linux support yet)
- Local-first architecture (no cloud sync)
- FunASR requires Python environment (Stage 3 implementation)
- AI features require external API keys (OpenAI-compatible endpoints)
- Add to Memory, 每次我提出新需求都使用需求 agent 分析和技术 agent 拆解任务