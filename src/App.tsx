import { useState, useEffect } from 'react';
import { api, Chatbot } from './lib/api';

function App() {
  const [url, setUrl] = useState('');
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [embedCode, setEmbedCode] = useState<string | null>(null);

  useEffect(() => {
    loadChatbots();
  }, []);

  const loadChatbots = async () => {
    setLoading(true);
    try {
      const bots = await api.getAllChatbots();
      setChatbots(bots);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setCreating(true);
    setError(null);
    setEmbedCode(null);

    try {
      const result = await api.createChatbot(url);
      setEmbedCode(result.embedCode);
      setUrl('');
      await loadChatbots();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chatbot?')) return;

    try {
      await api.deleteChatbot(id);
      await loadChatbots();
    } catch (err: any) {
      alert('Failed to delete chatbot: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Build Your AI Chatbot</h1>
          <p className="text-gray-600">Enter a website URL to generate a custom chatbot in minutes.</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                Website URL
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="url"
                  name="url"
                  id="url"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={creating}
                />
                <button
                  type="submit"
                  disabled={creating || !url}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Chatbot'}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="text-sm text-red-700 mt-2">{error}</div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {embedCode && (
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <h3 className="text-lg font-medium text-green-900 mb-2">🎉 Chatbot Created Successfully!</h3>
            <p className="text-green-700 mb-4">Add this code to your website to display the widget:</p>
            <div className="relative">
              <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                {embedCode}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(embedCode)}
                className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Your Chatbots</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {loading && chatbots.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">Loading chatbots...</li>
            ) : chatbots.length === 0 ? (
              <li className="px-4 py-8 text-center text-gray-500">No chatbots created yet. Try adding one above!</li>
            ) : (
              chatbots.map((bot) => (
                <li key={bot.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">{bot.title || bot.url}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <button
                            onClick={() => handleDelete(bot.id)}
                            className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {bot.url}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            Created {new Date(bot.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
