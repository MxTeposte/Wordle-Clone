import { createPractice } from '@/server/game-service';
import { errorResponse, isServiceError, json, readJson } from '@/server/http';

export async function POST(request: Request) {
  const result = await createPractice(await readJson(request));
  if (isServiceError(result)) return errorResponse(result);
  return json(result);
}
