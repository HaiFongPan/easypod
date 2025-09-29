import React, { useEffect } from 'react';
import { useNavigationStore } from '../store/navigationStore';

const SimpleMainContent: React.FC = () => {
  const { currentView, setCurrentView } = useNavigationStore();

  useEffect(() => {
    console.log('SimpleMainContent mounted, currentView:', currentView);
  }, []);

  useEffect(() => {
    console.log('currentView changed to:', currentView);
  }, [currentView]);

  return (
    <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Current View: {currentView}
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setCurrentView('subscriptions')}
            className="p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Subscriptions
          </button>
          <button
            onClick={() => setCurrentView('recently-played')}
            className="p-4 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Recently Played
          </button>
          <button
            onClick={() => setCurrentView('completed')}
            className="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Completed
          </button>
          <button
            onClick={() => setCurrentView('transcriptions')}
            className="p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Transcriptions
          </button>
          <button
            onClick={() => setCurrentView('ai-summaries')}
            className="p-4 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            AI Summaries
          </button>
          <button
            onClick={() => setCurrentView('rss-tester')}
            className="p-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            RSS Tester
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">View Content</h2>
          {currentView === 'subscriptions' && (
            <div>
              <h3 className="text-lg font-medium mb-2">Subscriptions</h3>
              <p>This is where your podcast subscriptions would be displayed.</p>
            </div>
          )}
          {currentView === 'recently-played' && (
            <div>
              <h3 className="text-lg font-medium mb-2">Recently Played</h3>
              <p>This is where your recently played episodes would be shown.</p>
            </div>
          )}
          {currentView === 'completed' && (
            <div>
              <h3 className="text-lg font-medium mb-2">Completed</h3>
              <p>This is where your completed episodes would be listed.</p>
            </div>
          )}
          {currentView === 'transcriptions' && (
            <div>
              <h3 className="text-lg font-medium mb-2">Transcriptions</h3>
              <p>This is where audio transcriptions would be displayed.</p>
            </div>
          )}
          {currentView === 'ai-summaries' && (
            <div>
              <h3 className="text-lg font-medium mb-2">AI Summaries</h3>
              <p>This is where AI-generated summaries would be shown.</p>
            </div>
          )}
          {currentView === 'rss-tester' && (
            <div>
              <h3 className="text-lg font-medium mb-2">RSS Tester</h3>
              <p>This is where you would test RSS feeds.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleMainContent;