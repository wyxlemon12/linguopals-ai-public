export const readJsonBody = (req: any) => {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

export const sendJson = (res: any, status: number, body: unknown) => {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
};

export const handleApiError = (res: any, error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  sendJson(res, 500, { error: message });
};
