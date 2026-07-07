// The model occasionally emits a malformed/incomplete structured output on larger schemas
// (concatenated JSON, garbled text, or a suspiciously small result) but reliably succeeds
// within a couple of retries — shared by the fetch* calls instead of each rolling its own loop.
export async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
