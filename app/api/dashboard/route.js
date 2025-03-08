import { NextResponse } from 'next/server';
import { getConnectionStatus } from '@/utils/connectionStatus';
import { getRecentActivities } from '@/utils/activityLogger';
import { getSyncStats } from '@/utils/syncStats';

export async function GET() {
  try {
    // Get connection status
    const connectionStatus = await getConnectionStatus();
    
    // Get sync statistics
    const syncStats = await getSyncStats();
    
    // Get recent activities
    const activities = await getRecentActivities(10); // Get last 10 activities
    
    return NextResponse.json({
      stats: {
        mondayConnected: connectionStatus.monday,
        mailchimpConnected: connectionStatus.mailchimp,
        lastSync: syncStats.lastSync,
        contactsSynced: syncStats.contactsCount,
        campaignsTracked: syncStats.campaignsCount,
        emailOpens: syncStats.opensCount,
        emailClicks: syncStats.clicksCount
      },
      activities
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
} 