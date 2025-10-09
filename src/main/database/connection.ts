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
        last_pub_date TEXT,
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
        status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed')),
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

    // Create LLM providers table (before models and summaries due to FK)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT,
        headers_json TEXT,
        timeout INTEGER DEFAULT 30000,
        token_usage INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create LLM models table (before summaries due to FK)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        token_usage INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE
      )
    `);

    // Create prompts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        is_builtin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create episode AI summaries table (after providers and models)
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

    // Create transcript settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcript_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL UNIQUE,
        config_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      const hasLastPubDate = feedsInfo.some((col) => col.name === 'last_pub_date');

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

      if (!hasLastPubDate) {
        console.log('Running migration: Adding last_pub_date to feeds table');
        this.db.exec('ALTER TABLE feeds ADD COLUMN last_pub_date TEXT');
        this.db.exec(`
          UPDATE feeds
          SET last_pub_date = (
            SELECT MAX(pub_date) FROM episodes WHERE episodes.feed_id = feeds.id
          )
          WHERE last_pub_date IS NULL
        `);
      }

      const voiceTextTaskTable = this.db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='episode_voice_text_tasks'",
        )
        .get() as { sql?: string } | undefined;

      const hasLegacyStatusEnum = voiceTextTaskTable?.sql?.includes(
        "status IN ('processing', 'success', 'failed')",
      );

      if (hasLegacyStatusEnum) {
        console.log(
          'Running migration: Normalizing episode_voice_text_tasks status values',
        );
        this.db.exec('BEGIN');
        try {
          this.db.exec(
            "ALTER TABLE episode_voice_text_tasks RENAME TO episode_voice_text_tasks_legacy",
          );

          this.db.exec(`
            CREATE TABLE episode_voice_text_tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              episode_id INTEGER NOT NULL,
              task_id TEXT NOT NULL,
              output TEXT NOT NULL,
              service TEXT NOT NULL CHECK(service IN ('funasr', 'aliyun')),
              status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed')),
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
          `);

          this.db.exec(`
            INSERT INTO episode_voice_text_tasks (
              id,
              episode_id,
              task_id,
              output,
              service,
              status,
              created_at,
              updated_at
            )
            SELECT
              id,
              episode_id,
              task_id,
              output,
              service,
              CASE WHEN status = 'success' THEN 'succeeded' ELSE status END,
              created_at,
              updated_at
            FROM episode_voice_text_tasks_legacy
          `);

          this.db.exec('DROP TABLE episode_voice_text_tasks_legacy');

          this.db.exec(
            'CREATE INDEX IF NOT EXISTS idx_voice_text_tasks_episode ON episode_voice_text_tasks(episode_id)',
          );
          this.db.exec(
            'CREATE INDEX IF NOT EXISTS idx_voice_text_tasks_status ON episode_voice_text_tasks(status)',
          );

          this.db.exec('COMMIT');
        } catch (migrationError) {
          this.db.exec('ROLLBACK');
          throw migrationError;
        }
      }

      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private async insertDefaults(): Promise<void> {
    if (!this.db) return;

    // Insert default AI prompts if not exists
    const existingPrompts = this.db.prepare('SELECT COUNT(*) as count FROM prompts WHERE is_builtin = 1').get() as { count: number };

    if (existingPrompts.count === 0) {
      const insertPrompt = this.db.prepare(`
        INSERT INTO prompts (name, type, prompt, is_builtin)
        VALUES (?, ?, ?, 1)
      `);

      insertPrompt.run(
        'Default Summary',
        'summary',
        '请总结以下播客内容的核心观点、金句和行动建议，并生成 5-10 个相关标签。返回 JSON 格式：{"summary": "总结内容", "tags": ["标签1", "标签2"]}'
      );

      insertPrompt.run(
        'Default Chapters',
        'chapters',
        '请分析以下播客内容，将其分为若干章节，每个章节包含开始时间（毫秒）、结束时间（毫秒）和总结。返回 JSON 格式：{"chapters": [{"start": 0, "end": 60000, "summary": "章节总结"}]}'
      );

      insertPrompt.run(
        'Default Mindmap',
        'mindmap',
        '请将以下播客内容整理为 Markdown 格式的思维导图。返回 JSON 格式：{"mindmap": "# 主题\\n## 子主题"}'
      );

      console.log('Default prompts inserted');
    }
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
