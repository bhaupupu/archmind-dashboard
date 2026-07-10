import { NextRequest } from 'next/server';

/**
 * Parses a JSON request body without throwing. A malformed body must surface
 * as a 400 from the route, not as an unhandled SyntaxError → opaque 500.
 */
export async function readJsonBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
