export function shouldAttachAdminToken(url: string): boolean {
  return url === "/api/admin" || url.startsWith("/api/admin/");
}

export function buildApiHeaders(
  hasJsonBody: boolean,
  accessToken?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}
