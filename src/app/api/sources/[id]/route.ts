import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, updateSource, deleteSource } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = await getSourceById(id);
  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  return NextResponse.json(source);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const source = await updateSource(id, {
    name: body.name,
    url: body.url,
    enabled: body.enabled,
    scrapeIntervalHours: body.scrapeIntervalHours,
    scrapeInstructions: body.scrapeInstructions,
    tags: body.tags,
    city: body.city,
  });

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteSource(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
