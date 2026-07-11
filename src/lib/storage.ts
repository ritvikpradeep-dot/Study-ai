import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export function documentStoragePath(userId: string, documentId: string, filename: string) {
  return path.join(userId, documentId, filename);
}

export async function saveUploadedFile(relativePath: string, buffer: Buffer) {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_ROOT, relativePath));
}
