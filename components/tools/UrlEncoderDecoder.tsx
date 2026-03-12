"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Mode = "encode" | "decode";

function useCopyFlag() {
  const [isCopied, setIsCopied] = useState(false);

  const trigger = useCallback(() => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, []);

  const reset = useCallback(() => setIsCopied(false), []);

  return { isCopied, trigger, reset };
}

async function copyToClipboard(value: string) {
  if (!value) return;
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(value);
}

function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

function decodeUrl(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    throw new Error("Invalid percent-encoded string. Make sure the input is properly URL-encoded.");
  }
}

export default function UrlEncoderDecoder() {
  const [mode, setMode] = useState<Mode>("encode");
  const [plainInput, setPlainInput] = useState("");
  const [encodedOutput, setEncodedOutput] = useState("");
  const [encodedInput, setEncodedInput] = useState("");
  const [decodedOutput, setDecodedOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const encodedCopy = useCopyFlag();
  const decodedCopy = useCopyFlag();

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    encodedCopy.reset();
    decodedCopy.reset();
  };

  const handleEncode = () => {
    setError(null);
    try {
      const result = encodeUrl(plainInput);
      setEncodedOutput(result);
      encodedCopy.reset();
    } catch (encodeError) {
      setError((encodeError as Error).message || "Unable to encode string.");
      setEncodedOutput("");
    }
  };

  const handleDecode = () => {
    setError(null);
    try {
      const result = decodeUrl(encodedInput);
      setDecodedOutput(result);
      decodedCopy.reset();
    } catch (decodeError) {
      setError((decodeError as Error).message || "Unable to decode string.");
      setDecodedOutput("");
    }
  };

  const copyValue = async (value: string, onSuccess: () => void) => {
    try {
      await copyToClipboard(value);
      onSuccess();
    } catch (clipboardError) {
      setError((clipboardError as Error).message || "Unable to copy to clipboard.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "encode" ? "default" : "outline"}
            onClick={() => switchMode("encode")}
          >
            Encode URL
          </Button>
          <Button
            type="button"
            variant={mode === "decode" ? "default" : "outline"}
            onClick={() => switchMode("decode")}
          >
            Decode URL
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Percent-encode or decode URL components safely in your browser.
        </p>
      </div>

      {mode === "encode" ? (
        <>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="url-plain">Plain text / URL</Label>
              <Textarea
                id="url-plain"
                value={plainInput}
                onChange={(e) => setPlainInput(e.target.value)}
                spellCheck={false}
                placeholder="Paste text or a URL to encode…"
                className="min-h-[180px] font-mono text-sm"
              />
            </div>
            <Button type="button" onClick={handleEncode} disabled={plainInput.length === 0}>
              Encode
            </Button>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="url-encoded">Encoded output</Label>
              <Button
                type="button"
                variant="outline"
                disabled={encodedOutput.length === 0}
                onClick={() => void copyValue(encodedOutput, encodedCopy.trigger)}
              >
                {encodedCopy.isCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Textarea
              id="url-encoded"
              readOnly
              value={encodedOutput}
              spellCheck={false}
              className="min-h-[220px] font-mono text-xs"
              placeholder="Encoded output will appear here."
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="url-encoded-input">Encoded URL / string</Label>
              <Textarea
                id="url-encoded-input"
                value={encodedInput}
                onChange={(e) => setEncodedInput(e.target.value)}
                spellCheck={false}
                placeholder="Paste a percent-encoded string to decode…"
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
            <Button type="button" onClick={handleDecode} disabled={encodedInput.trim().length === 0}>
              Decode
            </Button>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="url-decoded">Decoded text</Label>
              <Button
                type="button"
                variant="outline"
                disabled={decodedOutput.length === 0}
                onClick={() => void copyValue(decodedOutput, decodedCopy.trigger)}
              >
                {decodedCopy.isCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Textarea
              id="url-decoded"
              readOnly
              value={decodedOutput}
              spellCheck={false}
              className="min-h-[220px] font-mono text-sm"
              placeholder="Decoded text will appear here."
            />
            <p className="text-xs text-muted-foreground">
              Uses <code className="font-mono">decodeURIComponent</code> — safe for query params, path segments, and full URLs.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
