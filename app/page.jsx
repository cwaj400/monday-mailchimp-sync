import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Monday-Mailchimp Integration</h1>
        
        <p className="text-xl mb-8">
          A robust integration service that synchronizes contacts between Monday.com and Mailchimp, 
          with Discord notifications for important events.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Features</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Bidirectional contact synchronization</li>
              <li>Webhook support for Mailchimp events</li>
              <li>Real-time Discord notifications</li>
              <li>Secure API authentication</li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
            <div className="space-y-4">
              <Link 
                href="/dashboard" 
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-center"
              >
                Go to Dashboard
              </Link>
              <Link 
                href="/setup" 
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-center"
              >
                Setup Integration
              </Link>
              <Link 
                href="/docs" 
                className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-center"
              >
                View Documentation
              </Link>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h2 className="text-2xl font-semibold mb-4">Service Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">API Status:</span>
              <span className="ml-2 text-green-600">✅ Online</span>
            </div>
            <div>
              <span className="font-medium">Environment:</span>
              <span className="ml-2">{process.env.NODE_ENV || 'development'}</span>
            </div>
            <div>
              <span className="font-medium">Monday.com:</span>
              <span className="ml-2 text-green-600">✅ Connected</span>
            </div>
            <div>
              <span className="font-medium">Mailchimp:</span>
              <span className="ml-2 text-green-600">✅ Connected</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 