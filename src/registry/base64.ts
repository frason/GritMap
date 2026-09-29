const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * UTF-8-safe base64 encoding, needed for GitHub's Contents API (which requires base64
 * file content). Deliberately not `btoa`/`Buffer`: `btoa` assumes a binary string (mangles
 * multi-byte characters, e.g. accented segment names) and `Buffer` doesn't exist in the
 * React Native runtime this also has to run in -- `TextEncoder` is the one API both this
 * app's Node test environment and its React Native runtime actually share.
 */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? "=" : BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? "=" : BASE64_CHARS[b2 & 0x3f];
  }
  return result;
}
