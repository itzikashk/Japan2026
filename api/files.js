// List / update / delete family-file metadata. All requests here are
// already gated by middleware.js (session cookie required) before they
// ever reach this function.

import { del } from "@vercel/blob";
import { getFilesIndex, saveFilesIndex } from "../lib/blob-store.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const index = await getFilesIndex();
    let files = index.files;
    const { day, category, q, important } = req.query;

    if (day) files = files.filter((f) => String(f.tripDay) === String(day));
    if (category) files = files.filter((f) => f.category === category);
    if (important === "1") files = files.filter((f) => f.important);
    if (q) {
      const needle = String(q).trim().toLowerCase();
      files = files.filter(
        (f) =>
          (f.displayName || "").toLowerCase().includes(needle) ||
          (f.originalFilename || "").toLowerCase().includes(needle) ||
          (f.description || "").toLowerCase().includes(needle)
      );
    }
    files = files.slice().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    res.status(200).json({ files });
    return;
  }

  if (req.method === "PATCH") {
    const { id, displayName, category, description, important } = req.body || {};
    if (!id) {
      res.status(400).json({ error: "missing id" });
      return;
    }
    const index = await getFilesIndex();
    const file = index.files.find((f) => f.id === id);
    if (!file) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (typeof displayName === "string" && displayName.trim()) file.displayName = displayName.trim().slice(0, 200);
    if (typeof category === "string") file.category = category;
    if (typeof description === "string") file.description = description.slice(0, 500);
    if (typeof important === "boolean") file.important = important;
    await saveFilesIndex(index);
    res.status(200).json({ file });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: "missing id" });
      return;
    }
    const index = await getFilesIndex();
    const idx = index.files.findIndex((f) => f.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [removed] = index.files.splice(idx, 1);
    try {
      await del(removed.pathname);
    } catch (e) {
      // Blob object already gone — still proceed to remove the metadata
      // so nothing orphaned lingers in the index.
    }
    await saveFilesIndex(index);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
