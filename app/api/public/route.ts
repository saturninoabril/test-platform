import { NextResponse } from 'next/server';
import { withEventLogging } from '@/lib/events/with-logging';

async function handleGET() {
  return NextResponse.json({
    message: 'This is public data, no authentication required',
    timestamp: new Date().toISOString(),
  });
}

// Export with event logging
export const GET = withEventLogging(handleGET);
