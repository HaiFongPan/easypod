export interface Feed {
  id: string;
  title: string;
  url: string;
  description: string;
  coverUrl?: string;
  category: string;
  episodeCount: number;
  lastCheckedAt: string;
  status: 'active' | 'updating' | 'error' | 'paused';
  error?: string;
  createdAt: string;
  updatedAt: string;
  author?: string | null;
  categories?: string[] | null;
  isSubscribed?: boolean; // Whether user has subscribed to this feed
  subscribedAt?: string | null; // When user subscribed (ISO string)
}

export interface Episode {
  id: string;
  feedId: string;
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  durationSec?: number;
  episodeImageUrl?: string;
  pubDate: string;
  status: 'new' | 'in_progress' | 'played' | 'archived';
  position?: number;
  chapters?: Chapter[];
}

export interface Chapter {
  title: string;
  startTime: number;
  endTime?: number;
  url?: string;
}

export interface ImportResult {
  feeds: Partial<Feed>[];
  errors: string[];
}

export type ViewMode = 'grid' | 'list';
export type SortBy = 'title' | 'updated' | 'episodes';

export interface SubscriptionFilters {
  searchQuery: string;
  selectedCategories: string[];
  sortBy: SortBy;
}
