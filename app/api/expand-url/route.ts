import { NextRequest, NextResponse } from "next/server";

type ExpandUrlResponse = {
  shortUrl: string;
  longUrl: string | null;
  status: "success" | "error";
  statusCode?: number;
  method?: "HEAD" | "GET";
  durationMs?: number;
  error?: string;
};

const MAX_URLS = 20;
const REQUEST_TIMEOUT_MS = 10_000;

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON body.",
        details: (error as Error).message,
      },
      { status: 400 },
    );
  }

  const urls =
    Array.isArray((payload as { urls?: unknown }).urls) ?
      (payload as { urls: unknown[] }).urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean)
    : [];

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one short URL to expand." },
      { status: 400 },
    );
  }

  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_URLS} URLs can be expanded at once.` },
      { status: 400 },
    );
  }

  const results = await Promise.all(urls.map(resolveUrl));

  return NextResponse.json({ results });
}

async function resolveUrl(url: string): Promise<ExpandUrlResponse> {
  try {
    // Validate URL structure early so we can surface a helpful message.
    // new URL(...) throws on invalid inputs.
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return {
      shortUrl: url,
      longUrl: null,
      status: "error",
      error: "Invalid URL.",
    };
  }

  let lastErrorMessage = "Unable to resolve URL.";

  const methods: Array<"HEAD" | "GET"> = ["HEAD", "GET"];
  const retryStatuses = new Set([401, 402, 403, 405, 406, 429, 500, 502, 503, 504]);

  for (const method of methods) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        headers: COMMON_HEADERS,
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          shortUrl: url,
          longUrl: response.url,
          status: "success",
          statusCode: response.status,
          method,
          durationMs,
        };
      }

      // Some providers reject HEAD requests or require authentication; retry with GET.
      if (method === "HEAD" && retryStatuses.has(response.status)) {
        lastErrorMessage = `Rejected with status ${response.status}.`;
        continue;
      }

      return {
        shortUrl: url,
        longUrl: response.url,
        status: "error",
        statusCode: response.status,
        method,
        durationMs,
        error: `Request failed with status ${response.status}.`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        lastErrorMessage = `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`;
      } else {
        lastErrorMessage = (error as Error).message || lastErrorMessage;
      }
    }
  }

  return {
    shortUrl: url,
    longUrl: null,
    status: "error",
    error: lastErrorMessage,
  };
}
