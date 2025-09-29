import { useMemo, useState } from 'react';
import { Feed, SortBy } from '../types/subscription';

export const useSubscriptionFilter = (feeds: Feed[] = []) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('title');

  // Get unique categories from feeds
  const availableCategories = useMemo(() => {
    if (!feeds || feeds.length === 0) return [];
    const categories = feeds.map(feed => feed.category);
    return Array.from(new Set(categories)).sort();
  }, [feeds]);

  // Filter and sort feeds
  const filteredFeeds = useMemo(() => {
    if (!feeds || feeds.length === 0) return [];
    let result = feeds.filter(feed => {
      // Search in title and description
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        feed.title.toLowerCase().includes(searchLower) ||
        feed.description.toLowerCase().includes(searchLower);

      // Filter by category
      const matchesCategory = selectedCategories.length === 0 ||
        selectedCategories.includes(feed.category);

      return matchesSearch && matchesCategory;
    });

    // Sort results
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
          return new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime();
        case 'episodes':
          return b.episodeCount - a.episodeCount;
        default:
          return 0;
      }
    });

    return result;
  }, [feeds, searchQuery, selectedCategories, sortBy]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSortBy('title');
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    sortBy,
    setSortBy,
    filteredFeeds,
    availableCategories,
    clearFilters,
    hasActiveFilters: searchQuery || selectedCategories.length > 0 || sortBy !== 'title',
  };
};