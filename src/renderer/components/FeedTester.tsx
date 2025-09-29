import React, { useState } from 'react';
import { getElectronAPI } from '../utils/electron';

/**
 * RSS Feed Tester Component
 * Simple component to test the RSS parsing functionality
 */
export const FeedTester: React.FC = () => {
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testFeed = async () => {
    if (!feedUrl.trim()) return;

    setLoading(true);
    setError(null);
      setResult(null);

    try {
      // Test feed validation first
      const validation = await getElectronAPI().feeds.validate(feedUrl);

      if (validation.valid) {
        // If valid, try to subscribe
        const subscription = await getElectronAPI().feeds.subscribe(feedUrl);
        setResult({ validation, subscription });
      } else {
        setError(validation.error || 'Feed validation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getCacheStats = async () => {
    try {
      const stats = await getElectronAPI().feeds.getCacheStats();
      alert(`Cache: ${stats.size} feeds cached\nURLs: ${stats.urls.join(', ')}`);
    } catch (err) {
      alert('Failed to get cache stats');
    }
  };

  const clearCache = async () => {
    try {
      await getElectronAPI().feeds.clearCache();
      alert('Cache cleared successfully');
    } catch (err) {
      alert('Failed to clear cache');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">RSS Feed Tester</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            RSS Feed URL:
          </label>
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/feed.xml"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={testFeed}
            disabled={loading || !feedUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Test Feed'}
          </button>

          <button
            onClick={getCacheStats}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Cache Stats
          </button>

          <button
            onClick={clearCache}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear Cache
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-red-800 font-medium">Error:</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-green-800 font-medium mb-2">Success!</h3>

            {result.validation && (
              <div className="mb-4">
                <h4 className="font-medium">Validation Result:</h4>
                <p className="text-sm text-gray-600">
                  Valid: {result.validation.valid ? 'Yes' : 'No'}
                </p>
                {result.validation.title && (
                  <p className="text-sm text-gray-600">
                    Title: {result.validation.title}
                  </p>
                )}
              </div>
            )}

            {result.subscription && (
              <div>
                <h4 className="font-medium">Subscription Result:</h4>
                <pre className="text-xs bg-white p-2 rounded border mt-1 overflow-auto">
                  {JSON.stringify(result.subscription, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600">
          <h3 className="font-medium mb-2">Test URLs:</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setFeedUrl('https://feeds.npr.org/500005/podcast.xml')}
                className="text-blue-600 hover:underline text-left"
              >
                NPR Up First (iTunes enhanced)
              </button>
            </li>
            <li>
              <button
                onClick={() => setFeedUrl('https://changelog.com/master/feed')}
                className="text-blue-600 hover:underline text-left"
              >
                Changelog Master Feed (Podcast 2.0)
              </button>
            </li>
            <li>
              <button
                onClick={() => setFeedUrl('https://rss.cnn.com/rss/edition.rss')}
                className="text-blue-600 hover:underline text-left"
              >
                CNN RSS (Basic RSS)
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
