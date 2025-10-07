import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

type DatabaseInstance = Database.Database;
type DrizzleDatabase = ReturnType<typeof drizzle>;

export class DatabaseManager {
  private db: DatabaseInstance | null = null;
  private drizzle: DrizzleDatabase | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'database');

    // Ensure database directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = join(dbDir, 'easypod.db');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.drizzle = drizzle(this.db, { schema });

      // Configure SQLite for optimal performance
      this.configureSQLite();

      // Run initial setup
      await this.setupDatabase();

      console.log('Database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private configureSQLite(): void {
    if (!this.db) return;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Set synchronous mode for performance vs safety balance
    this.db.pragma('synchronous = NORMAL');

    // Increase cache size
    this.db.pragma('cache_size = -64000'); // 64MB cache

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Set temp store to memory
    this.db.pragma('temp_store = memory');

    // Optimize memory-mapped I/O
    this.db.pragma('mmap_size = 268435456'); // 256MB
  }

  private async setupDatabase(): Promise<void> {
    if (!this.drizzle) return;

    try {
      // Create tables if they don't exist
      await this.createTables();

      // Run migrations
      await this.runMigrations();

      // Create FTS5 search index
      await this.createSearchIndex();

      // Insert default settings and prompts
      await this.insertDefaults();

      console.log('Database setup completed');
    } catch (error) {
      console.error('Database setup failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Tables are created automatically by Drizzle migrations
    // For now, we'll create them manually since migrations aren't set up yet

    // Create feeds table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        cover_url TEXT,
        description TEXT,
        last_checked_at TEXT,
        opml_group TEXT,
        meta_json TEXT,
        is_subscribed INTEGER NOT NULL DEFAULT 0,
        subscribed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create episodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER NOT NULL,
        guid TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description_html TEXT,
        audio_url TEXT NOT NULL,
        pub_date TEXT,
        duration_sec INTEGER,
        episode_image_url TEXT,
        local_audio_path TEXT,
        status TEXT DEFAULT 'new',
        last_played_at TEXT,
        last_position_sec INTEGER DEFAULT 0,
        meta_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      )
    `);

    // Create play queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS play_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL UNIQUE,
        position INTEGER NOT NULL,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    // Create playback state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playback_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        current_episode_id INTEGER,
        current_position INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (current_episode_id) REFERENCES episodes(id) ON DELETE SET NULL
      )
    `);

    // Ensure a single playback state row exists
    this.db.exec(`
      INSERT OR IGNORE INTO playback_state (id, current_episode_id, current_position, updated_at)
      VALUES (1, NULL, 0, CURRENT_TIMESTAMP)
    `);

    // Create episode voice text tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episode_voice_text_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL,
        task_id TEXT NOT NULL,
        output TEXT NOT NULL,
        service TEXT NOT NULL CHECK(service IN ('funasr', 'aliyun')),
        status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'success', 'failed')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_voice_text_tasks_episode
      ON episode_voice_text_tasks(episode_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_voice_text_tasks_status
      ON episode_voice_text_tasks(status)
    `);

    // Create episode voice texts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episode_voice_texts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL,
        raw_json TEXT NOT NULL,
        service TEXT NOT NULL CHECK(service IN ('funasr', 'aliyun')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
        UNIQUE(episode_id, service)
      )
    `);

    // Create episode transcripts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episode_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL UNIQUE,
        subtitles TEXT NOT NULL,
        text TEXT NOT NULL,
        speaker_number INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    // Create episode AI summaries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episode_ai_summarys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL UNIQUE,
        summary TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '',
        chapters TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    console.log('All tables created successfully');
  }

  private async createSearchIndex(): Promise<void> {
    if (!this.db) return;

    // Create FTS5 virtual table for search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        episode_id UNINDEXED,
        title,
        description,
        transcript_text,
        ai_summary,
        content='episodes',
        content_rowid='id'
      )
    `);

    // Create triggers to keep FTS index updated
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS episodes_ai_search AFTER INSERT ON episodes BEGIN
        INSERT INTO search_index(episode_id, title, description)
        VALUES (new.id, new.title, new.description_html);
      END
    `);
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    try {
      // Migration 1: Add isSubscribed and subscribedAt to feeds table
      const feedsInfo = this.db.pragma('table_info(feeds)') as Array<{ name: string }>;
      const hasIsSubscribed = feedsInfo.some((col) => col.name === 'is_subscribed');
      const hasSubscribedAt = feedsInfo.some((col) => col.name === 'subscribed_at');

      if (!hasIsSubscribed) {
        console.log('Running migration: Adding is_subscribed to feeds table');
        this.db.exec('ALTER TABLE feeds ADD COLUMN is_subscribed INTEGER NOT NULL DEFAULT 1');
      }

      if (!hasSubscribedAt) {
        console.log('Running migration: Adding subscribed_at to feeds table');
        this.db.exec('ALTER TABLE feeds ADD COLUMN subscribed_at TEXT DEFAULT NULL');
        // Backfill subscribedAt with createdAt for existing feeds
        this.db.exec('UPDATE feeds SET subscribed_at = created_at WHERE is_subscribed = 1');
      }

      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private async insertDefaults(): Promise<void> {
    // Insert default AI prompts
    const defaultPrompts = [
      {
        name: 'Podcast Summary',
        category: 'summary',
        templateText: `Summarize this podcast episode in 8-12 bullet points and 3-5 action items:

Title: \${title}
Date: \${pub_date}
Chapters: \${chapters}

Transcript excerpt:
\${transcript_excerpt}

Output in Markdown with sections: **Key Points**, **Quotes**, **Action Items**`,
        variablesJson: JSON.stringify(['title', 'pub_date', 'chapters', 'transcript_excerpt']),
        isBuiltin: true,
      },
      {
        name: 'Smart Chapters',
        category: 'chapters',
        templateText: `Generate time-stamped chapters for this podcast episode:

Transcript: \${full_transcript}

Create chapter titles that are concise and descriptive, with timestamps in MM:SS format. Include 20-40 word summaries for each chapter.`,
        variablesJson: JSON.stringify(['full_transcript']),
        isBuiltin: true,
      }
    ];

    // TODO: Insert default prompts when database is available
    console.log('Default prompts prepared:', defaultPrompts.length);
  }

  // Public methods for database access
  getDrizzle(): DrizzleDatabase {
    if (!this.drizzle) {
      throw new Error('Database not initialized');
    }
    return this.drizzle;
  }

  getRawDb(): DatabaseInstance {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.drizzle = null;
    }
  }

  // Utility methods
  async vacuum(): Promise<void> {
    if (this.db) {
      this.db.exec('VACUUM');
    }
  }

  async backup(backupPath: string): Promise<void> {
    if (this.db) {
      this.db.backup(backupPath);
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  async getStats(): Promise<{
    feeds: number;
    episodes: number;
    transcripts: number;
    aiTasks: number;
    dbSize: number;
  }> {
    if (!this.drizzle) {
      return { feeds: 0, episodes: 0, transcripts: 0, aiTasks: 0, dbSize: 0 };
    }

    // TODO: Implement stats collection when database is available
    return {
      feeds: 0,
      episodes: 0,
      transcripts: 0,
      aiTasks: 0,
      dbSize: 0,
    };
  }
}

// Singleton instance
let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager();
  }
  return dbManager;
}

// Temporary mock database for development
export const db = {
  select: () => ({
    from: () => ({
      where: () => ({
        get: () => Promise.resolve(null),
        all: () => Promise.resolve([]),
      }),
      orderBy: () => ({
        limit: () => ({
          offset: () => Promise.resolve([]),
        }),
        all: () => Promise.resolve([]),
        get: () => Promise.resolve(null),
      }),
      limit: () => ({
        offset: () => Promise.resolve([]),
      }),
      all: () => Promise.resolve([]),
      get: () => Promise.resolve(null),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve([]),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve({}),
    }),
  }),
  delete: () => ({
    where: () => Promise.resolve({}),
  }),
};
