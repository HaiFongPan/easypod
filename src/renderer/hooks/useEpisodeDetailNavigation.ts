import { useCallback } from 'react';
import type { Episode } from '../store/episodesStore';
import { useEpisodeDetailStore } from '../store/episodeDetailStore';
import { useNavigationStore } from '../store/navigationStore';

export const useEpisodeDetailNavigation = () => {
  const setEpisode = useEpisodeDetailStore((state) => state.setEpisode);
  const setCurrentView = useNavigationStore((state) => state.setCurrentView);

  return useCallback((episode: Episode) => {
    setEpisode(episode);
    setCurrentView('episode-detail');
  }, [setEpisode, setCurrentView]);
};
