// Receives a single file as multipart/form-data, stores it in Vercel
// Blob, and appends a metadata record to the shared index. Protected
// by middleware.js like every other route except /api/auth.

import formidable from "formidable";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { getFilesIndex, saveFilesIndex } from "../lib/blob-store.js";

export const config = {
  api: { bodyParser: false },
};

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
// Images are compressed client-side before upload, so this ceiling is
// mostly a backstop for PDFs and any file that skipped compression.
// Kept under Vercel's own ~4.5MB hard request-body limit for serverless
// functions, which would reject anything larger before this code even
// runs (and did so silently from the client's point of view, since a
// platform-level rejection isn't a JSON response formidable can parse).
const MAX_SIZE = 4 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const form = formidable({ maxFileSize: MAX_SIZE, multiples: false });

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    res.status(400).json({ error: "הקובץ גדול מדי או שגיאה בהעלאה. נסו שוב עם קובץ קטן יותר." });
    return;
  }

  const file = files.file && files.file[0];
  if (!file) {
    res.status(400).json({ error: "לא נבחר קובץ" });
    return;
  }

  const mimeType = file.mimetype || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) {
    res.status(400).json({ error: "סוג קובץ לא נתמך. אפשר PDF, JPG, PNG, WEBP או HEIC." });
    return;
  }

  const tripDayRaw = fields.tripDay && fields.tripDay[0];
  const tripDay = tripDayRaw ? Number(tripDayRaw) : null;
  const originalFilename = file.originalFilename || "file";
  const displayName = (fields.displayName && fields.displayName[0]) || originalFilename;
  const category = (fields.category && fields.category[0]) || "אחר";

  const buffer = await fs.readFile(file.filepath);
  const id = crypto.randomUUID();
  const ext = originalFilename.includes(".") ? originalFilename.split(".").pop() : "";
  const pathname = `trip-files/${id}${ext ? "." + ext : ""}`;

  let blob;
  try {
    blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
  } catch (e) {
    res.status(500).json({ error: "ההעלאה לאחסון נכשלה. בדקו שה-Blob Store מוגדר בפרויקט." });
    return;
  }

  const record = {
    id,
    tripDay,
    originalFilename,
    displayName,
    fileType: mimeType,
    mimeType,
    fileSize: buffer.length,
    uploadDate: new Date().toISOString(),
    storageURL: blob.url,
    pathname: blob.pathname,
    description: "",
    category,
    important: false,
  };

  const index = await getFilesIndex();
  index.files.push(record);
  await saveFilesIndex(index);

  res.status(200).json({ file: record });
}
