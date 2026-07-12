import { put, del } from "@vercel/blob";

export function documentBlobPath(userId: string, documentId: string, filename: string) {
  return `${userId}/${documentId}/${filename}`;
}

export async function saveUploadedFile(blobPath: string, buffer: Buffer): Promise<string> {
  const blob = await put(blobPath, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });
  return blob.url;
}

export async function readStoredFile(storageUrl: string): Promise<Buffer> {
  const res = await fetch(storageUrl);
  if (!res.ok) throw new Error(`Failed to fetch stored file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteStoredFile(storageUrl: string): Promise<void> {
  await del(storageUrl);
}
