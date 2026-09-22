// Manual (user-added) expenses only. Confirmed costs (flights, the four
// hotel bookings) are static content in index.html, same as the rest of
// the itinerary/hotels — not stored here, and not editable via the API,
// so a stray delete can never make a paid booking's cost disappear.

import { put, list } from "@vercel/blob";

const INDEX_PATHNAME = "meta/expenses-index.json";

export async function getExpensesIndex() {
  const { blobs } = await list({ prefix: INDEX_PATHNAME });
  const match = blobs.find((b) => b.pathname === INDEX_PATHNAME);
  if (!match) return { expenses: [] };
  const res = await fetch(match.url, { cache: "no-store" });
  if (!res.ok) return { expenses: [] };
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.expenses)) return { expenses: [] };
  return data;
}

export async function saveExpensesIndex(index) {
  await put(INDEX_PATHNAME, JSON.stringify(index), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
