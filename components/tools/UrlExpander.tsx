"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ExpansionResult = {
  shortUrl: string;
  longUrl: string | null;
  status: "success" | "error";
  statusCode?: number;
  method?: "HEAD" | "GET";
  durationMs?: number;
  error?: string;
};

const API_ENDPOINT = "/api/expand-url";

function parseUrls(input: string) {
  return input
    .split(/\s+/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

export default function UrlExpander() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ExpansionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExpand = async () => {
    const urls = parseUrls(input);

    if (urls.length === 0) {
      setError("Enter at least one short URL.");
      setResults([]);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls }),
      });

      const payload = (await response.json()) as {
        error?: string;
        results?: ExpansionResult[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to expand URLs.");
        setResults([]);
        return;
      }

      setResults(payload.results ?? []);
    } catch (requestError) {
      setError((requestError as Error).message ?? "Unexpected error.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleExpand();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="short-urls">Short URLs</Label>
          <Textarea
            id="short-urls"
            placeholder={"https://bit.ly/xyz\nhttps://tinyurl.com/abc"}
            value={input}
            spellCheck={false}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[160px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Paste one or more shortened URLs separated by spaces or new lines. Up to 20 at a time.
          </p>
        </div>
        <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
          {isLoading ? "Expanding…" : "Expand URLs"}
        </Button>
      </form>

      {error ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} URL{results.length === 1 ? "" : "s"} processed.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Short URL
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Expanded URL
                  </th>
                  <th scope="col" className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {results.map((result, index) => (
                  <tr key={`${result.shortUrl}-${index}`}>
                    <td className="max-w-[320px] truncate px-4 py-3 font-medium text-card-foreground">
                      <a
                        href={result.shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-primary hover:underline"
                      >
                        {result.shortUrl}
                      </a>
                    </td>
                    <td className="max-w-[480px] px-4 py-3">
                      {result.status === "success" && result.longUrl ? (
                        <a
                          href={result.longUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-emerald-600 hover:underline"
                        >
                          {result.longUrl}
                        </a>
                      ) : (
                        <span className="break-all text-destructive">
                          {result.error ?? "Expansion failed."}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {result.status === "success" ? "Success" : "Error"}
                      {result.statusCode ? ` (${result.statusCode})` : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
