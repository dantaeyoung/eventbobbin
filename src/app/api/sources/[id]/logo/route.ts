import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sources } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await db
      .select({ logoData: sources.logoData })
      .from(sources)
      .where(eq(sources.id, id));

    if (rows.length === 0 || !rows[0].logoData) {
      return new NextResponse(null, { status: 404 });
    }

    const logoData = rows[0].logoData;

    // logoData is stored as "data:image/png;base64,..." format
    const matches = logoData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.error('Logo data format invalid for source:', id, 'starts with:', logoData.substring(0, 50));
      return new NextResponse(null, { status: 404 });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
