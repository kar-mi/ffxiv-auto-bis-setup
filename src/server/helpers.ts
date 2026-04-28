export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export function notFound(message: string): Response {
  return json({ error: message }, 404);
}
