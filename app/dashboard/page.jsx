'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({
    mondayConnected: false,
    mailchimpConnected: false,
    lastSync: null,
    contactsSynced: 0,
    campaignsTracked: 0,
    emailOpens: 0,
    emailClicks: 0
  });
  
  const [activities, setActivities] = useState([]);
  
  useEffect(() => {
    // Fetch dashboard data
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        if (response.ok) {
          setStats(data.stats);
          setActivities(data.activities);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };
    
    fetchDashboardData();
  }, []);
  
  const handleSyncNow = async () => {
    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST'
      });
      
      if (response.ok) {
        alert('Sync started successfully!');
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert(`Error starting sync: ${error.message}`);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Integration Dashboard</h1>
        <div className="space-x-4">
          <button
            onClick={handleSyncNow}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Sync Now
          </button>
          <Link
            href="/setup"
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Settings
          </Link>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Connection Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Monday.com</div>
            <div className="text-2xl font-bold mt-2">
              {stats.mondayConnected ? (
                <span className="text-green-600">Connected</span>
              ) : (
                <span className="text-red-600">Disconnected</span>
              )}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Mailchimp</div>
            <div className="text-2xl font-bold mt-2">
              {stats.mailchimpConnected ? (
                <span className="text-green-600">Connected</span>
              ) : (
                <span className="text-red-600">Disconnected</span>
              )}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Last Sync</div>
            <div className="text-2xl font-bold mt-2">
              {stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Sync Status</div>
            <div className="text-2xl font-bold mt-2 text-green-600">
              Active
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Sync Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Contacts Synced</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {stats.contactsSynced}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Campaigns Tracked</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {stats.campaignsTracked}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Email Opens</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {stats.emailOpens}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-gray-600 text-sm uppercase">Email Clicks</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {stats.emailClicks}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="border-b pb-4">
                <p className="font-medium">{activity.title}</p>
                <p className="text-gray-600">{activity.description}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No recent activity</p>
        )}
      </div>
    </div>
  );
} 