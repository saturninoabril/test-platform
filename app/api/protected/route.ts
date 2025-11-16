import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { withEventLogging } from '@/lib/events/with-logging';

async function handleGET() {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'This is protected data',
    user: {
      name: session.user.name,
      email: session.user.email,
    },
    timestamp: new Date().toISOString(),
  });
}

async function handlePOST(request: Request) {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  return NextResponse.json({
    message: 'Data received successfully',
    user: session.user.email,
    data: body,
  });
}

// Export with event logging
export const GET = withEventLogging(handleGET);
export const POST = withEventLogging(handlePOST);
