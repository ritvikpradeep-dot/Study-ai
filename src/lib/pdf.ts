// pdfjs-dist (used internally by pdf-parse) references browser globals like
// DOMMatrix at module load time even though we only need text extraction,
// not rendering. Polyfill them with no-op stubs before importing it so the
// module load doesn't crash in the Node.js serverless runtime.
function ensureDomStubs() {
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

export async function extractPdfText(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  ensureDomStubs();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}
