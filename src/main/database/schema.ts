import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Feeds table - podcast subscription sources
export const feeds = sqliteTable('feeds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  coverUrl: text('cover_url'),
  description: text('description'),
  lastCheckedAt: text('last_checked_at'), // ISO string
  lastPubDate: text('last_pub_date'),
  opmlGroup: text('opml_group'),
  metaJson: text('meta_json'), // JSON string for additional metadata
  isSubscribed: integer('is_subscribed', { mode: 'boolean' }).default(false).notNull(),
  subscribedAt: text('subscribed_at'), // ISO string - when user subscribed
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Episodes table - individual podcast episodes
export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  feedId: integer('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  guid: text('guid').notNull().unique(),
  title: text('title').notNull(),
  descriptionHtml: text('description_html'),
  audioUrl: text('audio_url').notNull(),
  pubDate: text('pub_date'), // ISO string
  durationSec: integer('duration_sec'),
  episodeImageUrl: text('episode_image_url'),
  localAudioPath: text('local_audio_path'),
  status: text('status').default('new'), // 'new' | 'in_progress' | 'played' | 'archived'
  lastPlayedAt: text('last_played_at'), // ISO string
  lastPositionSec: integer('last_position_sec').default(0),
  metaJson: text('meta_json'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Play queue table - maintains the playback order
export const playQueue = sqliteTable('play_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`),
});

// Playback state table - stores the last played episode and position
export const playbackState = sqliteTable('playback_state', {
  id: integer('id').primaryKey().default(1),
  currentEpisodeId: integer('current_episode_id')
    .references(() => episodes.id, { onDelete: 'set null' }),
  currentPosition: integer('current_position').default(0),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Chapters table - episode chapters from various sources
export const chapters = sqliteTable('chapters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms'),
  title: text('title').notNull(),
  imageUrl: text('image_url'),
  source: text('source').notNull(), // 'json' | 'id3' | 'shownote'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Transcripts table - transcription tasks and metadata
export const transcripts = sqliteTable('transcripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  engine: text('engine').notNull(), // 'funasr'
  lang: text('lang'),
  diarizationJson: text('diarization_json'), // Speaker diarization results
  srtPath: text('srt_path'),
  vttPath: text('vtt_path'),
  rawJsonPath: text('raw_json_path'),
  status: text('status').default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Transcript segments table - individual transcript segments
export const transcriptSegments = sqliteTable('transcript_segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transcriptId: integer('transcript_id').notNull().references(() => transcripts.id, { onDelete: 'cascade' }),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  speaker: text('speaker'), // 'S0', 'S1', or custom speaker names
  text: text('text').notNull(),
  tokensJson: text('tokens_json'), // Raw token data from ASR
  confidence: real('confidence'), // Confidence score 0-1
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// AI prompts table - prompt templates
export const aiPrompts = sqliteTable('ai_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'summary' | 'chapters' | 'mindmap' | 'chat'
  templateText: text('template_text').notNull(),
  variablesJson: text('variables_json'), // JSON array of variable names
  version: integer('version').default(1),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// AI tasks table - AI processing tasks and results
export const aiTasks = sqliteTable('ai_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptTemplateId: integer('prompt_template_id').references(() => aiPrompts.id),
  promptVarsJson: text('prompt_vars_json'), // JSON object with prompt variables
  status: text('status').default('queued'), // 'queued' | 'running' | 'succeeded' | 'failed'
  costUsd: real('cost_usd'),
  outputMd: text('output_md'),
  outputJson: text('output_json'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Exports table - export tasks and locations
export const exportTasks = sqliteTable('exports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  target: text('target').notNull(), // 'obsidian' | 'notion' | 'markdown' | 'pdf' | 'xmind'
  location: text('location'), // File path or URL
  status: text('status').default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  metaJson: text('meta_json'), // Additional export metadata
  lastExportedAt: text('last_exported_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Settings table - application settings
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  type: text('type').notNull(), // 'string' | 'number' | 'boolean' | 'json'
  description: text('description'),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// LLM Providers table - configured AI providers
export const llmProviders = sqliteTable('llm_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key'),
  headersJson: text('headers_json'), // JSON object
  timeout: integer('timeout').default(30000),
  tokenUsage: integer('token_usage').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// LLM Models table - models for each provider
export const llmModels = sqliteTable('llm_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: integer('provider_id').notNull().references(() => llmProviders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Display name like "GPT-4o"
  code: text('code').notNull(), // API code like "gpt-4o"
  tokenUsage: integer('token_usage').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Prompts table - prompt templates
export const prompts = sqliteTable('prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  type: text('type').notNull(), // 'system' | 'summary' | 'tag' | 'chapters' | 'mindmap'
  prompt: text('prompt').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// AI providers table - configured AI providers (deprecated, use llmProviders)
export const aiProviders = sqliteTable('ai_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  apiKey: text('api_key'), // Will be encrypted
  headersJson: text('headers_json'), // JSON object
  timeout: integer('timeout').default(30000),
  maxConcurrency: integer('max_concurrency').default(1),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Search index - FTS5 virtual table for full-text search
export const searchIndex = sqliteTable('search_index_fts', {
  rowid: integer('rowid').primaryKey(),
  episodeId: integer('episode_id'),
  title: text('title'),
  description: text('description'),
  transcriptText: text('transcript_text'),
  aiSummary: text('ai_summary'),
});

// Episode voice text tasks - transcription task tracking
export const episodeVoiceTextTasks = sqliteTable('episode_voice_text_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  output: text('output').notNull(), // Task output data JSON
  service: text('service', { enum: ['funasr', 'aliyun'] }).notNull(),
  status: text('status', { enum: ['pending', 'processing', 'succeeded', 'failed'] }).notNull().default('processing'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Episode voice texts - raw transcription data
export const episodeVoiceTexts = sqliteTable('episode_voice_texts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  rawJson: text('raw_json').notNull(), // Raw JSON data from service
  service: text('service', { enum: ['funasr', 'aliyun'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Episode transcripts - processed transcription data
export const episodeTranscripts = sqliteTable('episode_transcripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  subtitles: text('subtitles').notNull(), // JSON array of sentence_info
  text: text('text').notNull(), // Plain text content
  speakerNumber: integer('speaker_number').notNull().default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Episode AI summaries - AI analysis results
export const episodeAiSummarys = sqliteTable('episode_ai_summarys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull().default(''),
  tags: text('tags').notNull().default(''), // Comma-separated tags
  chapters: text('chapters').notNull().default('[]'), // JSON array of chapters
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Define relationships and types
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;

export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;

export type PlayQueueItem = typeof playQueue.$inferSelect;
export type NewPlayQueueItem = typeof playQueue.$inferInsert;

export type PlaybackState = typeof playbackState.$inferSelect;
export type NewPlaybackState = typeof playbackState.$inferInsert;

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;

export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;

export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;

export type AiPrompt = typeof aiPrompts.$inferSelect;
export type NewAiPrompt = typeof aiPrompts.$inferInsert;

export type AiTask = typeof aiTasks.$inferSelect;
export type NewAiTask = typeof aiTasks.$inferInsert;

export type ExportTask = typeof exportTasks.$inferSelect;
export type NewExportTask = typeof exportTasks.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type AiProvider = typeof aiProviders.$inferSelect;
export type NewAiProvider = typeof aiProviders.$inferInsert;

export type EpisodeVoiceTextTask = typeof episodeVoiceTextTasks.$inferSelect;
export type NewEpisodeVoiceTextTask = typeof episodeVoiceTextTasks.$inferInsert;

export type EpisodeVoiceText = typeof episodeVoiceTexts.$inferSelect;
export type NewEpisodeVoiceText = typeof episodeVoiceTexts.$inferInsert;

export type EpisodeTranscript = typeof episodeTranscripts.$inferSelect;
export type NewEpisodeTranscript = typeof episodeTranscripts.$inferInsert;

export type LlmProvider = typeof llmProviders.$inferSelect;
export type NewLlmProvider = typeof llmProviders.$inferInsert;

export type LlmModel = typeof llmModels.$inferSelect;
export type NewLlmModel = typeof llmModels.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type EpisodeAiSummary = typeof episodeAiSummarys.$inferSelect;
export type NewEpisodeAiSummary = typeof episodeAiSummarys.$inferInsert;
