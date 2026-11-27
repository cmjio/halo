import type { TelemetryEvent } from "./trace";

// Halo Studio is served by `halo serve`, so the API is on the same origin.
// If the server needs a token, Studio asks for it once, or takes it from ?token=<HALO_SERVE_TOKEN>.
const TOKEN_KEY = "halo-token";

const urlToken = new URLSearchParams(location.search).get("token");
if (urlToken) {
  saveToken(urlToken);
  history.replaceState(null, "", location.pathname + location.hash);
}

export function saveToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  /** The HTTP status, or 0 when the server could not be reached. */
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * An image or document a run holds, as an address the page can show or download. The file
 * is fetched with the token (an <img> can't send one), so the address is local to this page.
 */
export async function blobUrl(sha256: string): Promise<string> {
  const token = readToken();
  const res = await fetch(`/api/blobs/${sha256}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status === 404 ? "This file isn't on the server" : `Couldn't load the file (${res.status})`, res.status);
  return URL.createObjectURL(await res.blob());
}

/** Start a run with files: multipart, with the header that marks it as a client's (see the server's crossSite). */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Halo-Client": "studio", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form });
  } catch {
    throw new ApiError("Can't reach the Halo server", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `${res.status} ${res.statusText}`, res.status);
  return body as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  } catch {
    throw new ApiError("Can't reach the Halo server", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `${res.status} ${res.statusText}`, res.status);
  return body as T;
}

export type Api = typeof api;

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface PipelineInfo {
  name: string;
  file: string;
  params: Array<{ name: string; type: string }>;
  returnType?: string;
  schedules: Array<{ cron: string; tz?: string; next?: string }>;
  webhooks: string[];
}

export interface RunSummary {
  run_id: string;
  start_time: number;
  end_time: number;
  event_count: number;
  pipeline: string | null;
  /** completed, halted, paused, or error; null while no end is recorded */
  status: string | null;
  cost: number | null;
  /** Whether this server is running it right now. */
  running?: boolean;
}

/** What can be done to a run from Studio, as the server sees it now. */
export interface RunControls {
  /** It is running on this server: it can be stopped, and its budget raised. */
  stoppable: boolean;
  /** It failed, was stopped, or halted, and has a @checkpoint to continue from. */
  resumable: boolean;
  /** It has a step history (@checkpoint) to go back to. */
  rewindable: boolean;
  /** How many steps its history holds. */
  steps: number;
  /** It ended because someone stopped it. */
  stopped: boolean;
  /** Its MaxSpend limits (`limit` is the lowest, where the first agent stops) and what has been added; null when no agent has one. */
  budget: { limit: number; limits: number[]; added: number; spent: number | null } | null;
}

export interface RunDetail {
  runId: string;
  running: boolean;
  paused?: { waitingFor: string; message?: string; stage: number; approveUrl: string; /** Waiting for an OAuth connection (`connect:Google`): its name, and a fresh link to connect it (when this run may be offered one). */ connection?: string; connectUrl?: string };
  /** Missing from older servers. */
  controls?: RunControls;
  events: TelemetryEvent[];
}

/** One step of a @checkpoint run's history, to rewind to. */
export interface RunStep {
  step: number;
  stage: number;
  label: string;
  at: string;
  cost: number;
  tokens: { prompt: number; completion: number };
  halted?: true;
}
