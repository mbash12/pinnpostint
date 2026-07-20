import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Fetch the image from the backend and stream it through without
    // buffering the entire file in memory. This prevents large images from
    // spiking (and potentially leaking) the admin container's heap.
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json({ error: 'Empty response body' }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    // Error proxying image: error
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
  }
}
