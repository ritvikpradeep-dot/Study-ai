import { ensureDomStubs } from "@/lib/dom-polyfills";

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
