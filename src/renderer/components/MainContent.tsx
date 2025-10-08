import React from 'react';
import { useNavigationStore, AppView } from '../store/navigationStore';
import { SubscriptionList } from './Subscription';
import { FeedTester } from './FeedTester';
import { EpisodesListPage } from '../pages/EpisodesListPage';
import PlayQueuePage from '../pages/PlayQueuePage';
import EpisodeDetailPage from '../pages/EpisodeDetailPage';
import { TranscriptSettings, AISettings } from './Settings';

// Placeholder components for other views
const LibraryView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Library</h2>
    <p className="text-gray-600 dark:text-gray-400">Your podcast library will appear here.</p>
  </div>
);

const CompletedView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Completed</h2>
    <p className="text-gray-600 dark:text-gray-400">Your completed episodes will appear here.</p>
  </div>
);

const TranscriptionsView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Transcriptions</h2>
    <p className="text-gray-600 dark:text-gray-400">Audio transcriptions will appear here.</p>
  </div>
);

const AISummariesView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">AI Summaries</h2>
    <p className="text-gray-600 dark:text-gray-400">AI-generated summaries will appear here.</p>
  </div>
);

const SettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = React.useState<'general' | 'transcript' | 'ai'>('general');

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h2>
        </div>
        <nav className="px-3 space-y-1">
          <button
            onClick={() => setActiveSection('general')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'general'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            通用设置
          </button>
          <button
            onClick={() => setActiveSection('transcript')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'transcript'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            转写服务
          </button>
          <button
            onClick={() => setActiveSection('ai')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'ai'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            AI 配置
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${activeSection === 'ai' ? 'h-full flex flex-col' : ''} p-6`}>
          {activeSection === 'general' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">通用设置</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">应用程序的基本设置</p>
            </div>
          )}
          {activeSection === 'transcript' && <TranscriptSettings />}
          {activeSection === 'ai' && <AISettings />}
        </div>
      </div>
    </div>
  );
};

const MainContent: React.FC = () => {
  const currentView = useNavigationStore(state => state.currentView);

  console.log('MainContent rendering, currentView:', currentView);

  const renderView = (): React.ReactNode => {
    switch (currentView) {
      case 'library':
        return <LibraryView />;
      case 'subscriptions':
        try {
          return <SubscriptionList />;
        } catch (error) {
          console.error('Error rendering SubscriptionList:', error);
          return <div className="p-6"><h1>Subscriptions</h1><p>Error loading subscription list: {String(error)}</p></div>;
        }
      case 'episodes':
        return <EpisodesListPage />;
      case 'play-queue':
        return <PlayQueuePage />;
      case 'episode-detail':
        return <EpisodeDetailPage />;
      case 'completed':
        return <CompletedView />;
      case 'transcriptions':
        return <TranscriptionsView />;
      case 'ai-summaries':
        return <AISummariesView />;
      case 'settings':
        return <SettingsView />;
      case 'rss-tester':
        return <FeedTester />;
      default:
        return <div className="p-6"><h1>Default View</h1><p>Current view: {currentView}</p></div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        {renderView()}
      </div>
    </div>
  );
};

export default MainContent;
