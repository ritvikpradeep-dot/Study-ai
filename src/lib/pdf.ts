import { PDFParse } from "pdf-parse";

export async function extractPdfText(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}
