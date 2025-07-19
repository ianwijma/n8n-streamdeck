import { createStreamDeckAction } from '@n8n-streamdeck/shared';
import { getConfig } from '@n8n-streamdeck/config';

export default function Home() {
  const sampleAction = createStreamDeckAction(
    'sample',
    'Sample Action',
    '/icon.png'
  );

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">N8N StreamDeck Integration</h1>
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Sample Action</h2>
        <pre className="bg-gray-800 text-white p-2 rounded">
          {JSON.stringify(sampleAction, null, 2)}
        </pre>
      </div>
    </main>
  );
}