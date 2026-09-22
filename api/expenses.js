// CRUD for manually-added trip expenses. Protected by middleware.js
// like every other route except /api/auth. "Duplicate" isn't a
// separate server action — the client re-POSTs a copy with a new id.

import crypto from "node:crypto";
import { getExpensesIndex, saveExpensesIndex } from "../lib/expenses-store.js";

const VALID_CURRENCY = new Set(["AUD", "JPY"]);
const VALID_STATUS = new Set(["paid", "unpaid", "planned"]);

function sanitize(body) {
  const description = String(body.description || "").trim().slice(0, 200);
  const amount = Number(body.amount);
  const currency = VALID_CURRENCY.has(body.currency) ? body.currency : "AUD";
  const category = String(body.category || "אחר").slice(0, 40);
  const date = String(body.date || "").slice(0, 10);
  const tripDay = body.tripDay ? Number(body.tripDay) : null;
  const status = VALID_STATUS.has(body.status) ? body.status : "planned";
  const paidBy = String(body.paidBy || "Family").slice(0, 40);
  const notes = String(body.notes || "").slice(0, 500);
  const receiptFileId = body.receiptFileId ? String(body.receiptFileId) : null;
  if (!description || !amount || amount <= 0 || isNaN(amount)) return null;
  return { description, amount, currency, category, date, tripDay, status, paidBy, notes, receiptFileId };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const index = await getExpensesIndex();
    let expenses = index.expenses;
    const { day, category, status, currency, paidBy, q } = req.query;
    if (day) expenses = expenses.filter((e) => String(e.tripDay) === String(day));
    if (category) expenses = expenses.filter((e) => e.category === category);
    if (status) expenses = expenses.filter((e) => e.status === status);
    if (currency) expenses = expenses.filter((e) => e.currency === currency);
    if (paidBy) expenses = expenses.filter((e) => e.paidBy === paidBy);
    if (q) {
      const needle = String(q).trim().toLowerCase();
      expenses = expenses.filter(
        (e) =>
          (e.description || "").toLowerCase().includes(needle) ||
          (e.notes || "").toLowerCase().includes(needle)
      );
    }
    expenses = expenses.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    res.status(200).json({ expenses });
    return;
  }

  if (req.method === "POST") {
    const clean = sanitize(req.body || {});
    if (!clean) {
      res.status(400).json({ error: "נתונים חסרים או לא תקינים (תיאור וסכום חובה)." });
      return;
    }
    const record = Object.assign({ id: crypto.randomUUID(), createdAt: new Date().toISOString() }, clean);
    record.updatedAt = record.createdAt;
    const index = await getExpensesIndex();
    index.expenses.push(record);
    await saveExpensesIndex(index);
    res.status(200).json({ expense: record });
    return;
  }

  if (req.method === "PATCH") {
    const { id } = req.body || {};
    if (!id) {
      res.status(400).json({ error: "missing id" });
      return;
    }
    const index = await getExpensesIndex();
    const record = index.expenses.find((e) => e.id === id);
    if (!record) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const clean = sanitize(Object.assign({}, record, req.body || {}));
    if (!clean) {
      res.status(400).json({ error: "נתונים לא תקינים." });
      return;
    }
    Object.assign(record, clean, { updatedAt: new Date().toISOString() });
    await saveExpensesIndex(index);
    res.status(200).json({ expense: record });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: "missing id" });
      return;
    }
    const index = await getExpensesIndex();
    const idx = index.expenses.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "not found" });
      return;
    }
    index.expenses.splice(idx, 1);
    await saveExpensesIndex(index);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
