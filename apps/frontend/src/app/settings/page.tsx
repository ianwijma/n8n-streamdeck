// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure your StreamDeck Manager preferences
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Connection Settings
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>
                Configure how the application connects to your StreamDeck
                devices.
              </p>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Auto-connect to devices
                </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    defaultChecked
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Automatically connect to StreamDeck devices when detected
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Connection timeout (seconds)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    defaultValue={30}
                    min={5}
                    max={120}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              N8N Integration
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Configure your N8N instance for workflow integration.</p>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  N8N Base URL
                </label>
                <div className="mt-1">
                  <input
                    type="url"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="https://n8n.example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Your N8N API key"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Appearance
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Customize the appearance of your StreamDeck buttons.</p>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default button background color
                </label>
                <div className="mt-1">
                  <input
                    type="color"
                    className="block w-16 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    defaultValue="#000000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default text color
                </label>
                <div className="mt-1">
                  <input
                    type="color"
                    className="block w-16 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    defaultValue="#ffffff"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default font size
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    defaultValue={12}
                    min={8}
                    max={24}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
