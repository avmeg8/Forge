/** Short, collision-resistant id for local records (sync-friendly: no server sequence needed). */
export function uid(prefix = '') {
  const rnd = (globalThis.crypto && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 18);
  return `${prefix}${Date.now().toString(36)}${rnd.slice(0, 10)}`;
}
