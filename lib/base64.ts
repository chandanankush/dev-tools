const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBytes(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeToBytes(base64: string) {
  const sanitized = base64.replace(/\s+/g, "");

  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(sanitized, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  }

  const binary = atob(sanitized);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64(input: string) {
  const bytes = textEncoder.encode(input);
  return encodeBytes(bytes);
}

export function decodeBase64(input: string) {
  try {
    const bytes = decodeToBytes(input);
    return textDecoder.decode(bytes);
  } catch (error) {
    throw new Error((error as Error).message || "Failed to decode Base64.");
  }
}
