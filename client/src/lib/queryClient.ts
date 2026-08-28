import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { buildApiHeaders, shouldAttachAdminToken } from "@/lib/api-auth";
import { requestTimeoutSignal } from "@/lib/request-timeout";

async function getRequestHeaders(url: string, hasJsonBody: boolean): Promise<Record<string, string>> {
  // Admin routes are protected by Supabase. Send the current user's access
  // token only to our own admin API, never to third-party URLs.
  if (shouldAttachAdminToken(url) && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return buildApiHeaders(hasJsonBody, session?.access_token);
    } catch (error) {
      console.warn("[API] Could not read the Supabase session:", error);
    }
  }

  return buildApiHeaders(hasJsonBody);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: await getRequestHeaders(url, data !== undefined),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: requestTimeoutSignal(),
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      headers: await getRequestHeaders(url, false),
      credentials: "include",
      signal: requestTimeoutSignal(undefined, signal),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
