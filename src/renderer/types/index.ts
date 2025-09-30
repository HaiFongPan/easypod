// Core data types based on the PRD requirements

import type { Episode as StoreEpisode } from '../store/episodesStore';

export interface Feed {
  id: string;
  title: string;
  url: string;
  coverUrl?: string;
  lastCheckedAt?: Date;
  opmlGroup?: string;
  meta: Record<string, any>;
}

export type Episode = StoreEpisode;

export interface Chapter {
  id: string;
  episodeId: string;
  startMs: number;
  endMs: number;
  title: string;
  imageUrl?: string;
  source: 'json' | 'id3' | 'shownote';
}

export interface Transcript {
  id: string;
  episodeId: string;
  engine: 'funasr';
  lang?: string;
  diarizationJson?: any;
  srtPath?: string;
  vttPath?: string;
  rawJsonPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptSegment {
  id: string;
  transcriptId: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  text: string;
  tokensJson?: any;
}

export interface AITask {
  id: string;
  episodeId: string;
  provider: string;
  model: string;
  promptTemplateId: string;
  promptVarsJson: Record<string, any>;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  costUsd?: number;
  outputMd?: string;
  outputJson?: any;
  createdAt: Date;
}

// Player state
export interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0-1
  playbackRate: number; // 0.5-3.0
  isLoading: boolean;
  error: string | null;
}

// Library state
export interface LibraryState {
  feeds: Feed[];
  episodes: Episode[];
  currentFeed: Feed | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

// Settings state
export interface SettingsState {
  darkMode: boolean;
  mediaKeys: boolean;
  jumpSeconds: number;
  defaultPlaybackRate: number;
  downloadDirectory: string;
  autoRefreshInterval: number; // minutes
  asrModel: 'light' | 'standard' | 'enhanced';
  asrDevice: 'cpu' | 'gpu';
  asrConcurrency: number;
  aiProviders: AIProvider[];
  activeAIProvider: string | null;
}

// AI Provider interface
export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  headers: Record<string, string>;
  timeout: number;
  maxConcurrency: number;
}

// UI state
export interface UIState {
  sidebarCollapsed: boolean;
  activePanel: 'episodes' | 'chapters' | 'transcript' | 'ai' | 'chat';
  showTranscript: boolean;
  showChapters: boolean;
  modalStack: string[];
}
