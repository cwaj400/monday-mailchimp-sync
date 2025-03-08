import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only apply to API routes except for webhooks
  if (request.nextUrl.pathname.startsWith('/api') && 
      !request.nextUrl.pathname.startsWith('/api/webhooks')) {
    
    const apiKey = request.headers.get('x-api-key');
    
    // Check if API key is valid
    if (!apiKey || apiKey !== process.env.APP_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
}; 