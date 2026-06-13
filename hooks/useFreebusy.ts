"use client";

/**
 * SWR で GET /api/lifull/calendar/freebusy。
 * 5分キャッシュ。`calendar_not_shared` 等の fallback flag を error として返す。
 */
import useSWR from "swr";

export interface FreeBusySlot {
  start: string;
  end: string;
}

export interface CloserFreeBusy {
  closer_id: string;
  free_slots: FreeBusySlot[];
  busy_slots: FreeBusySlot[];
}

export interface FreeBusyResponse {
  closers: CloserFreeBusy[];
  cached?: boolean;
}

export interface FreeBusyError {
  code:
    | "calendar_not_shared"
    | "rate_limited"
    | "unauthorized"
    | "internal"
    | "network";
  message: string;
}

interface UseFreebusyArgs {
  closerIds: string[];
  from: string;
  to: string;
  enabled?: boolean;
}

class FreeBusyFetchError extends Error {
  code: FreeBusyError["code"];
  constructor(code: FreeBusyError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "FreeBusyFetchError";
  }
}

async function fetcher(url: string): Promise<FreeBusyResponse> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let body: { code?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore JSON parse failure
    }
    const code =
      (body.code as FreeBusyError["code"]) ??
      (res.status === 403
        ? "calendar_not_shared"
        : res.status === 429
          ? "rate_limited"
          : res.status === 401
            ? "unauthorized"
            : "internal");
    throw new FreeBusyFetchError(code, body.message ?? res.statusText);
  }
  return res.json();
}

/** Closer 一覧の FreeBusy を 5 分 SWR キャッシュで取得 */
export function useFreebusy(args: UseFreebusyArgs) {
  const { closerIds, from, to, enabled = true } = args;
  const key =
    enabled && closerIds.length > 0
      ? `/api/lifull/calendar/freebusy?closer_ids=${closerIds.join(",")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<
    FreeBusyResponse,
    FreeBusyFetchError
  >(key, fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: (e) => e.code === "internal" || e.code === "network",
    errorRetryCount: 2,
  });

  return {
    data,
    error: error
      ? ({ code: error.code, message: error.message } as FreeBusyError)
      : undefined,
    isLoading,
    refetch: mutate,
    calendarNotShared: error?.code === "calendar_not_shared",
  };
}

// END_OF_FILE
