// B2 — virus-scan hook. v1 ships a STUB that passes everything, behind a stable
// interface so a real scanner (ClamAV, a cloud AV API) drops in without touching
// the upload route. The route always calls this before it stores bytes, so the
// integration point exists from day one; the stub is clearly labelled, never
// dressed up as real protection.
export type ScanResult = "clean" | "infected" | "unavailable";

export interface VirusScanner {
  scan(bytes: Uint8Array): Promise<ScanResult>;
}

// The no-op stub. It reports 'clean' — it does NOT actually scan. Swap in a real
// scanner by setting `activeScanner`.
export const stubScanner: VirusScanner = {
  async scan() {
    return "clean";
  },
};

let activeScanner: VirusScanner = stubScanner;

export function setVirusScanner(scanner: VirusScanner): void {
  activeScanner = scanner;
}

export function scanForViruses(bytes: Uint8Array): Promise<ScanResult> {
  return activeScanner.scan(bytes);
}
