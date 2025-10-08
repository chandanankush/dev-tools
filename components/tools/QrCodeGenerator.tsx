"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Mode = "text" | "url";

const MAX_QR_CHARACTERS = 2953; // Maximum payload length supported by QR Code version 40 (binary mode).

const modeOptions: Array<{ value: Mode; label: string; description: string }> = [
  {
    value: "text",
    label: "Plain Text",
    description: "Encode the QR code as raw text (any characters).",
  },
  {
    value: "url",
    label: "URL",
    description: "Ensure the QR contains an absolute URL (https://example.com).",
  },
];

export default function QrCodeGenerator() {
  const [mode, setMode] = useState<Mode>("text");
  const [input, setInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const remainingCharacters = useMemo(() => MAX_QR_CHARACTERS - input.length, [input]);

  useEffect(() => {
    const value = input.trim();

    if (value.length === 0) {
      setQrDataUrl(null);
      setError(null);
      return;
    }

    if (mode === "url") {
      try {
        // new URL throws for invalid absolute URLs
        // eslint-disable-next-line no-new
        new URL(value);
      } catch {
        setError("Enter a valid absolute URL (including http/https).");
        setQrDataUrl(null);
        return;
      }
    }

    setError(null);
    setIsGenerating(true);
    let active = true;

    QRCode.toDataURL(value, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: "H",
    })
      .then((dataUrl) => {
        if (!active) return;
        setQrDataUrl(dataUrl);
      })
      .catch((generationError: unknown) => {
        if (!active) return;
        setError((generationError as Error).message ?? "Failed to generate QR code.");
        setQrDataUrl(null);
      })
      .finally(() => {
        if (!active) return;
        setIsGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [input, mode]);

  const handleInputChange = (value: string) => {
    if (value.length > MAX_QR_CHARACTERS) {
      setInput(value.slice(0, MAX_QR_CHARACTERS));
      return;
    }
    setInput(value);
  };

  const handleDownload = () => {
    if (!qrDataUrl) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "qr-code.png";
    anchor.click();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Encoding Mode
            </p>
            <p className="text-sm text-muted-foreground">
              Choose how the QR code should treat your input.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            {modeOptions.map((option) => {
              const isActive = option.value === mode;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setMode(option.value)}
                  className="md:min-w-[120px]"
                  aria-label={option.description}
                  title={option.description}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-input">QR content</Label>
        <Textarea
          id="qr-input"
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder={mode === "url" ? "https://example.com" : "Hello from Dev Toolkit"}
          spellCheck={false}
          className="min-h-[180px] font-mono text-sm"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {input.length}/{MAX_QR_CHARACTERS} characters
          </span>
          <span>{remainingCharacters >= 0 ? `${remainingCharacters} remaining` : "Limit reached"}</span>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-6 text-center">
        {qrDataUrl ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-white p-4 shadow-inner md:h-64 md:w-64">
              <Image
                src={qrDataUrl}
                alt="Generated QR code"
                width={512}
                height={512}
                className="h-full w-full object-contain"
                priority={false}
                sizes="(max-width: 768px) 192px, 256px"
              />
            </div>
            <Button type="button" onClick={handleDownload} className="w-full md:w-auto">
              Download PNG
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{isGenerating ? "Generating QR code…" : "Enter content above to preview the QR code."}</p>
            {isGenerating ? <p>This only takes a moment.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
