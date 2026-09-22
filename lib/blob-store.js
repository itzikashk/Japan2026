// The family-files metadata index: a single JSON blob listing every
// uploaded file's metadata. Kept at a fixed, non-randomized pathname
// so it can always be located without a separate database.

import { put, list } from "@vercel/blob";

const INDEX_PATHNAME = "meta/files-index.json";

export async function getFilesIndex() {
  const { blobs } = await list({ prefix: INDEX_PATHNAME });
  const match = blobs.find((b) => b.pathname === INDEX_PATHNAME);
  if (!match) return { files: [] };
  const res = await fetch(match.url, { cache: "no-store" });
  if (!res.ok) return { files: [] };
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.files)) return { files: [] };
  return data;
}

export async function saveFilesIndex(index) {
  await put(INDEX_PATHNAME, JSON.stringify(index), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
