const encoder = typeof globalThis !== 'undefined' && globalThis.TextEncoder ? new globalThis.TextEncoder() : null

export async function hashLocalCredential(value) {
  const secret = String(value || '')
  if (!secret) throw new Error('A credential is required.')
  if (!globalThis.crypto?.subtle || !encoder) throw new Error('Secure local credential storage is unavailable in this browser.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
