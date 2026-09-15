import 'server-only';
import { isServiceError, type ServiceError } from './game-service';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });

export const errorResponse = (err: ServiceError) => json({ error: err.error }, err.status);

export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export { isServiceError };
