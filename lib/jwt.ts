const encoder = new TextEncoder();

function utf8Bytes(input: string) {
  return encoder.encode(input);
}

function base64UrlEncode(bytes: Uint8Array) {
  let base64: string;
  if (typeof window === "undefined") {
    base64 = Buffer.from(bytes).toString("base64");
  } else {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSHA256(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", utf8Bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signature = await crypto.subtle.sign("HMAC", key, utf8Bytes(message));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlDecode(base64Url: string) {
  const paddingNeeded = base64Url.length % 4;
  const normalized = (paddingNeeded ? base64Url + "=".repeat(4 - paddingNeeded) : base64Url)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  if (typeof window === "undefined") {
    const buffer = Buffer.from(normalized, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  }

  const binary = atob(normalized);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let index = 0; index < len; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export type JwtPayloadInput = {
  clientID: string;
  secret: string;
  workflowName?: string;
  workflowId?: string;
  authCode?: string;
};

export async function createHs256Token({ clientID, secret, workflowName, workflowId, authCode }: JwtPayloadInput) {
  const header = base64UrlEncode(utf8Bytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));

  const payloadObject: Record<string, unknown> = {
    clientId: clientID,
    iss: "bos",
  };

  if (workflowName) payloadObject.workflowName = workflowName;
  if (workflowId) payloadObject.workflowId = workflowId;
  if (authCode) payloadObject.auth_code = authCode;

  const payload = base64UrlEncode(utf8Bytes(JSON.stringify(payloadObject)));

  const signature = await hmacSHA256(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

export function decodeJwt(token: string) {
  const segments = token.split(".");

  if (segments.length < 2) {
    throw new Error("Invalid JWT: tokens require at least header and payload.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;

  const decodedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
  const decodedPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));

  return {
    header: decodedHeader,
    payload: decodedPayload,
    signature: encodedSignature ?? null,
    hasSignature: Boolean(encodedSignature),
  };
}
