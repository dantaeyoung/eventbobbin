import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const value = getSetting(key);
  if (value === null) {
    return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
  }
  return NextResponse.json({ key, value: JSON.parse(value) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const body = await request.json();
  setSetting(key, JSON.stringify(body.value));
  return NextResponse.json({ key, value: body.value });
}
