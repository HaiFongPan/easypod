import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import MainContent from './components/MainContent';
import { useAppStore } from './store/appStore';
import { usePlayQueueStore } from './store/playQueueStore';
import { usePlayerStore } from './store/playerStore';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { version, platform, initialize } = useAppStore();

  useEffect(() => {
    // Initialize the app store
    initialize();

    const queueStore = usePlayQueueStore.getState();
    queueStore.loadQueue().catch((error) => {
      console.error('[App] Failed to load play queue', error);
    });

    const playerStore = usePlayerStore.getState();
    playerStore.loadPlaybackState().catch((error) => {
      console.error('[App] Failed to restore playback state', error);
    });

    // Check system dark mode preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [initialize]);

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="h-full">
      <Layout
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        appVersion={version}
        platform={platform}
      >
        <MainContent />
      </Layout>
    </div>
  );
}

export default App;
