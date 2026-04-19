import { sendMessageData } from "./_lib/ai";
import { handleApiError, readJsonBody, sendJson } from "./_lib/http";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = readJsonBody(req);
    const data = await sendMessageData(body);
    return sendJson(res, 200, data);
  } catch (error) {
    return handleApiError(res, error);
  }
}
