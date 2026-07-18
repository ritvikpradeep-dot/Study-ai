// pdfjs-dist (used by both pdf-parse on upload and react-pdf's viewer)
// references browser globals like DOMMatrix at module load time, even when
// only doing text extraction or when only meant to run client-side. Because
// it's marked serverExternalPackages in next.config.ts, its real module code
// executes in Node during SSR — not just at explicit import sites — so this
// needs to run once before anything else on the server, not be scattered
// before individual imports.
export function ensureDomStubs() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {};
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageData {};
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2D {};
  }
}
