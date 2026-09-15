import { checkGuess, resolveGame } from '@/server/game-service';
import { errorResponse, isServiceError, json, readJson } from '@/server/http';

export async function POST(request: Request) {
  const body = await readJson(request);
  const resolved = await resolveGame(body);
  if (isServiceError(resolved)) return errorResponse(resolved);
  const result = await checkGuess(resolved, (body as { guess?: unknown }).guess);
  if (isServiceError(result)) return errorResponse(result);
  return json(result);
}
