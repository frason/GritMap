/**
 * The one-time transfer id (docs/BLE_DIRECT_TRANSFER_CONTRACT.md): exactly 22 unpadded base64url
 * characters encoding 128 random bits. It is the package id and the key a receipt must echo. It is
 * never logged.
 */
const PATTERN = /^[A-Za-z0-9_-]{22}$/;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function isTransferId(value: string): boolean {
  return PATTERN.test(value);
}

/** Unpadded base64url of 16 random bytes. `randomBytes` must come from a CSPRNG (expo-crypto in the app). */
export function encodeTransferId(randomBytes: Uint8Array): string {
  if (randomBytes.length !== 16) throw new RangeError("A transfer id needs exactly 16 random bytes (128 bits)");
  let out = "";
  for (let i = 0; i < 15; i += 3) {
    const n = (randomBytes[i]! << 16) | (randomBytes[i + 1]! << 8) | randomBytes[i + 2]!;
    out += BASE64URL[(n >> 18) & 63]! + BASE64URL[(n >> 12) & 63]! + BASE64URL[(n >> 6) & 63]! + BASE64URL[n & 63]!;
  }
  const last = randomBytes[15]!;
  out += BASE64URL[last >> 2]! + BASE64URL[(last & 3) << 4]!;
  return out;
}
