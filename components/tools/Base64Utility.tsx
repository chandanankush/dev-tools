"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decodeBase64, encodeBase64 } from "@/lib/base64";

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

export default function Base64Utility() {
  const [mode, setMode] = useState<Mode>("encode");
  const [plainInput, setPlainInput] = useState("");
  const [encodedOutput, setEncodedOutput] = useState("");
  const [base64Input, setBase64Input] = useState("");
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
      const encoded = encodeBase64(plainInput);
      setEncodedOutput(encoded);
      encodedCopy.reset();
    } catch (encodeError) {
      setError((encodeError as Error).message || "Unable to encode string.");
      setEncodedOutput("");
    }
  };

  const handleDecode = () => {
    setError(null);
    try {
      const decoded = decodeBase64(base64Input);
      setDecodedOutput(decoded);
      decodedCopy.reset();
    } catch (decodeError) {
      setError((decodeError as Error).message || "Unable to decode Base64 string.");
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
            Encode Base64
          </Button>
          <Button
            type="button"
            variant={mode === "decode" ? "default" : "outline"}
            onClick={() => switchMode("decode")}
          >
            Decode Base64
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Convert between human-readable strings and Base64 safely in your browser.
        </p>
      </div>

      {mode === "encode" ? (
        <>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="base64-plain">Plain text</Label>
              <Textarea
                id="base64-plain"
                value={plainInput}
                onChange={(event) => setPlainInput(event.target.value)}
                spellCheck={false}
                placeholder="Paste text to encode…"
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
              <Label htmlFor="base64-encoded">Base64 output</Label>
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
              id="base64-encoded"
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
              <Label htmlFor="base64-input">Base64 input</Label>
              <Textarea
                id="base64-input"
                value={base64Input}
                onChange={(event) => setBase64Input(event.target.value)}
                spellCheck={false}
                placeholder="Paste Base64 to decode…"
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
            <Button type="button" onClick={handleDecode} disabled={base64Input.trim().length === 0}>
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
              <Label htmlFor="base64-decoded">Decoded text</Label>
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
              id="base64-decoded"
              readOnly
              value={decodedOutput}
              spellCheck={false}
              className="min-h-[220px] font-mono text-sm"
              placeholder="Decoded text will appear here."
            />
            <p className="text-xs text-muted-foreground">
              Binary data is decoded using UTF-8. If the result looks garbled, the original content may not be text.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
