import React from 'react';
import { useNavigationStore, AppView } from '../store/navigationStore';
import { SubscriptionList } from './Subscription';
import { FeedTester } from './FeedTester';
import { EpisodesListPage } from '../pages/EpisodesListPage';

// Placeholder components for other views
const LibraryView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Library</h2>
    <p className="text-gray-600 dark:text-gray-400">Your podcast library will appear here.</p>
  </div>
);

const RecentlyPlayedView: React.FC = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Recently Played</h2>
    <p className="text-gray-600 dark:text-gray-400">Your recently played episodes will appear here.</p>
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
      case 'recently-played':
        return <RecentlyPlayedView />;
      case 'completed':
        return <CompletedView />;
      case 'transcriptions':
        return <TranscriptionsView />;
      case 'ai-summaries':
        return <AISummariesView />;
      case 'rss-tester':
        return <FeedTester />;
      default:
        return <div className="p-6"><h1>Default View</h1><p>Current view: {currentView}</p></div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
      {renderView()}
    </div>
  );
};

export default MainContent;