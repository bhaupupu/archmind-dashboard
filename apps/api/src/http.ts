/**
 * Tiny zero-dependency HTTP router + helpers (JSON, SSE). This exists only so the
 * API layer runs on the current toolchain without an install; production is
 * NestJS (docs/01), which provides routing, guards (tenancy/auth), DI, and
 * OpenAPI generation. The route table here mirrors the intended NestJS controllers.
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  tenantId: string; // from x-tenant-id; production derives from auth (docs/08)
  body(): Promise<unknown>;
}

type Handler = (ctx: Ctx) => Promise<void> | void;
interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler }

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const rx = path.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; });
  return { pattern: new RegExp(`^${rx}$`), keys };
}

export class Router {
  private routes: Route[] = [];
  add(method: string, path: string, handler: Handler): void {
    const { pattern, keys } = compile(path);
    this.routes.push({ method, pattern, keys, handler });
  }
  get(path: string, h: Handler) { this.add('GET', path, h); }
  post(path: string, h: Handler) { this.add('POST', path, h); }

  listen(port: number, cb?: () => void): Server {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const route = this.routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
      if (!route) return json(res, 404, { error: 'not_found', path: url.pathname });
      const m = route.pattern.exec(url.pathname)!;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
      const ctx: Ctx = {
        req, res, params, query: url.searchParams,
        tenantId: String(req.headers['x-tenant-id'] ?? 'default'),
        body: () => readJson(req),
      };
      try { await route.handler(ctx); }
      catch (err) { json(res, 500, { error: 'internal', message: (err as Error).message }); }
    });
    return server.listen(port, cb);
  }
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/**
 * Server-Sent Events stream (docs/01: SSE end-to-end). Emits `data:`-only frames
 * so a plain fetch-stream reader (the Next.js dashboard) can consume them without
 * EventSource: each frame is one JSON payload; the run ends with a `[DONE]`
 * sentinel. The event stage lives inside the JSON payload (`{stage, message}`).
 */
export class SseStream {
  private readonly res: ServerResponse;
  constructor(res: ServerResponse) {
    this.res = res;
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
  }
  /** Emit one JSON frame. */
  data(payload: unknown): void {
    this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  /** Terminal sentinel, then close. */
  done(): void {
    this.res.write('data: [DONE]\n\n');
    this.res.end();
  }
  close(): void { this.res.end(); }
}
