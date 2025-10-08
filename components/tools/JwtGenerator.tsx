"use client";

import { useCallback, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHs256Token, decodeJwt } from "@/lib/jwt";

type EncodeFormState = {
  clientID: string;
  secret: string;
  workflowName: string;
  workflowId: string;
  authCode: string;
};

type Mode = "encode" | "decode";

type DecodedResult = {
  header: string;
  payload: string;
  signature: string | null;
  hasSignature: boolean;
};

const encodeInitialState: EncodeFormState = {
  clientID: "your-client-id",
  secret: "your-shared-secret",
  workflowName: "onboarding",
  workflowId: "wf_123",
  authCode: "abc123",
};

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
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(value);
}

export default function JwtGenerator() {
  const [mode, setMode] = useState<Mode>("encode");

  // Encode state
  const [form, setForm] = useState<EncodeFormState>(encodeInitialState);
  const [generatedToken, setGeneratedToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const generatedCopy = useCopyFlag();

  // Decode state
  const [decodeInput, setDecodeInput] = useState("");
  const [decodedResult, setDecodedResult] = useState<DecodedResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const decodedHeaderCopy = useCopyFlag();
  const decodedPayloadCopy = useCopyFlag();
  const decodedSignatureCopy = useCopyFlag();

  const updateField = (field: keyof EncodeFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setEncodeError(null);
    setDecodeError(null);
    generatedCopy.reset();
    decodedHeaderCopy.reset();
    decodedPayloadCopy.reset();
    decodedSignatureCopy.reset();
  };

  const handleGenerate = async () => {
    setEncodeError(null);
    generatedCopy.reset();

    if (!form.clientID.trim()) {
      setEncodeError("Client ID is required.");
      return;
    }

    if (!form.secret.trim()) {
      setEncodeError("Shared secret is required.");
      return;
    }

    setIsProcessing(true);

    try {
      const jwt = await createHs256Token({
        clientID: form.clientID.trim(),
        secret: form.secret,
        workflowName: form.workflowName.trim() || undefined,
        workflowId: form.workflowId.trim() || undefined,
        authCode: form.authCode.trim() || undefined,
      });
      setGeneratedToken(jwt);
    } catch (generationError) {
      setGeneratedToken("");
      setEncodeError((generationError as Error).message || "Failed to generate JWT.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecode = async () => {
    setDecodeError(null);
    decodedHeaderCopy.reset();
    decodedPayloadCopy.reset();
    decodedSignatureCopy.reset();

    const trimmed = decodeInput.trim();

    if (!trimmed) {
      setDecodeError("Paste a JWT to decode.");
      setDecodedResult(null);
      return;
    }

    setIsProcessing(true);

    try {
      const result = decodeJwt(trimmed);
      setDecodedResult({
        header: JSON.stringify(result.header, null, 2),
        payload: JSON.stringify(result.payload, null, 2),
        signature: result.signature,
        hasSignature: result.hasSignature,
      });
    } catch (decodeErrorInstance) {
      setDecodedResult(null);
      setDecodeError((decodeErrorInstance as Error).message || "Unable to decode JWT.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyGeneratedToken = async () => {
    if (!generatedToken) return;
    try {
      await copyToClipboard(generatedToken);
      generatedCopy.trigger();
    } catch (clipboardError) {
      setEncodeError((clipboardError as Error).message || "Unable to copy to clipboard.");
    }
  };

  const copyDecodedText = async (value: string, setError: (message: string) => void, onSuccess: () => void) => {
    if (!value) return;
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
            Encode JWT
          </Button>
          <Button
            type="button"
            variant={mode === "decode" ? "default" : "outline"}
            onClick={() => switchMode("decode")}
          >
            Decode JWT
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate HS256 tokens or inspect existing ones without leaving the browser.
        </p>
      </div>

      {mode === "encode" ? (
        <>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleGenerate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                autoComplete="off"
                value={form.clientID}
                onChange={updateField("clientID")}
                placeholder="your-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret">Shared secret</Label>
              <Input
                id="secret"
                type="password"
                autoComplete="off"
                value={form.secret}
                onChange={updateField("secret")}
                placeholder="your-shared-secret"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow name</Label>
              <Input
                id="workflow-name"
                autoComplete="off"
                value={form.workflowName}
                onChange={updateField("workflowName")}
                placeholder="onboarding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-id">Workflow ID</Label>
              <Input
                id="workflow-id"
                autoComplete="off"
                value={form.workflowId}
                onChange={updateField("workflowId")}
                placeholder="wf_123"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="auth-code">Auth code</Label>
              <Input
                id="auth-code"
                autoComplete="off"
                value={form.authCode}
                onChange={updateField("authCode")}
                placeholder="abc123"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? "Generating…" : "Generate JWT"}
              </Button>
            </div>
          </form>

          {encodeError ? (
            <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {encodeError}
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="jwt-output">JWT Token</Label>
              <Button type="button" variant="outline" disabled={!generatedToken} onClick={() => void copyGeneratedToken()}>
                {generatedCopy.isCopied ? "Copied!" : "Copy token"}
              </Button>
            </div>
            <Textarea
              id="jwt-output"
              readOnly
              value={generatedToken}
              spellCheck={false}
              className="min-h-[220px] font-mono text-xs"
              placeholder="Generate a token to see the output here."
            />
          </div>
        </>
      ) : (
        <>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleDecode();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="jwt-input">JWT token</Label>
              <Textarea
                id="jwt-input"
                value={decodeInput}
                spellCheck={false}
                onChange={(event) => setDecodeInput(event.target.value)}
                placeholder="eyJhbGciOi..."
                className="min-h-[160px] font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Decoding…" : "Decode JWT"}
            </Button>
          </form>

          {decodeError ? (
            <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {decodeError}
            </p>
          ) : null}

          {decodedResult ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="jwt-header">Header</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyDecodedText(decodedResult.header, setDecodeError, decodedHeaderCopy.trigger)}
                    >
                      {decodedHeaderCopy.isCopied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <Textarea
                    id="jwt-header"
                    readOnly
                    value={decodedResult.header}
                    className="min-h-[200px] font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="jwt-payload">Payload</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void copyDecodedText(decodedResult.payload, setDecodeError, decodedPayloadCopy.trigger)
                      }
                    >
                      {decodedPayloadCopy.isCopied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <Textarea
                    id="jwt-payload"
                    readOnly
                    value={decodedResult.payload}
                    className="min-h-[200px] font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="jwt-signature">Signature</Label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!decodedResult.signature}
                    onClick={() => {
                      if (!decodedResult.signature) return;
                      void copyDecodedText(decodedResult.signature, setDecodeError, decodedSignatureCopy.trigger);
                    }}
                  >
                    {decodedSignatureCopy.isCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <Textarea
                  id="jwt-signature"
                  readOnly
                  value={
                    decodedResult.signature ??
                    "No signature segment present. This token may be unsecured (alg=none) or truncated."
                  }
                  className="min-h-[120px] font-mono text-xs"
                  spellCheck={false}
                />
                {!decodedResult.hasSignature ? (
                  <p className="text-xs text-muted-foreground">
                    This token does not include a signature component. Verification is not possible.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              Paste a JWT and decode it to inspect the header, payload, and signature segments.
            </p>
          )}
        </>
      )}
    </div>
  );
}
