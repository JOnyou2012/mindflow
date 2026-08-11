/**
 * Crypto-safe UUID generator with fallback for HTTP / old browsers.
 *
 * crypto.randomUUID() requires a secure context (HTTPS or localhost).
 * On plain HTTP or Safari < 15.4 / Firefox < 95, it throws TypeError.
 * This wrapper provides a fallback using Math.random().
 *
 * @returns {string} A UUID-like string (36 chars with dashes)
 */
export function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback: high-entropy random string with UUID v4 format
    const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return hex() + hex() + '-' + hex() + '-4' + hex().slice(1) + '-' +
      (8 + Math.floor(Math.random() * 4)).toString(16) + hex() + '-' +
      hex() + hex() + hex();
  }
}
