// Next runs register() once per server process at startup. We use it only to log
// which storage adapter is active and to WARN (not throw) if production would
// fall back to the local filesystem — enforcement stays in getStorageAdapter so a
// misconfiguration fails storage operations, not the whole app boot.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logStorageConfig } = await import("./lib/storage/index.ts");
    logStorageConfig();
  }
}
