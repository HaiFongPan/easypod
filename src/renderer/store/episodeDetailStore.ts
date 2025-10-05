import { create } from 'zustand';
import type { Episode } from './episodesStore';

interface EpisodeDetailState {
  selectedEpisode: Episode | null;
  setEpisode: (episode: Episode) => void;
  clearEpisode: () => void;
}

export const useEpisodeDetailStore = create<EpisodeDetailState>((set) => ({
  selectedEpisode: null,
  setEpisode: (episode) => set({ selectedEpisode: episode }),
  clearEpisode: () => set({ selectedEpisode: null }),
}));
