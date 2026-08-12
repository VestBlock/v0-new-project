import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function retiredResponse() {
  return NextResponse.json(
    {
      error: 'This database setup endpoint has been retired. Apply reviewed migrations through the database deployment workflow.',
    },
    { status: 410 },
  );
}

export const GET = retiredResponse;
export const POST = retiredResponse;
