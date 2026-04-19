import { updateMissionStatusData } from "./_lib/ai.js";
import { handleApiError, readJsonBody, sendJson } from "./_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = readJsonBody(req);
    const data = await updateMissionStatusData(body.history || [], body.missions || []);
    return sendJson(res, 200, data);
  } catch (error) {
    return handleApiError(res, error);
  }
}
