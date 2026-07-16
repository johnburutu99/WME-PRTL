import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API Route — Proxy
 *
 * All frontend API calls go to /api/proxy/... which this handler
 * forwards to the NestJS backend, injecting the httpOnly JWT cookie
 * as a Bearer token. This means:
 *  - The JWT is NEVER accessible from browser JavaScript
 *  - The frontend origin is locked to the backend CORS policy
 *  - All requests are authenticated server-side
 *
 * IMPORTANT: Uses BACKEND_API_URL (private, server-only) — NOT NEXT_PUBLIC_.
 * Set BACKEND_API_URL in Vercel environment variables for the backend host.
 */

// Private server-side env var — never exposed to the browser
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/${path}${url.search}`;

  const token = req.cookies.get('wme_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body,
  });

  const responseBody = await backendRes.text();

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: {
      'Content-Type': backendRes.headers.get('Content-Type') || 'application/json',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/${path}${url.search}`;

  const token = req.cookies.get('wme_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Forward the original request body for POST/PATCH
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body,
  });

  const responseBody = await backendRes.text();

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: {
      'Content-Type': backendRes.headers.get('Content-Type') || 'application/json',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}
