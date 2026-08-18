import * as Crypto from "expo-crypto";

/** SHA-256 of the actual file bytes -- never a URI, decoded text, or base64 stand-in. */
export async function computeFileHash(bytes: BufferSource): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
