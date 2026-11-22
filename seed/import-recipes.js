// Adds the recipes from seed/recipes80.json to Firestore, skipping names that already exist.
// Run by .github/workflows/seed-recipes.yml (service account via GOOGLE_APPLICATION_CREDENTIALS).
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

initializeApp({ projectId: process.env.PROJECT });
const db = getFirestore();

(async () => {
  const file = path.join(__dirname, "recipes80.json");
  const { recipes } = JSON.parse(fs.readFileSync(file, "utf8"));
  const existing = await db.collection("recipes").get();
  const have = new Set(existing.docs.map(d => String(d.get("name") || "").trim().toLowerCase()));
  const now = new Date().toISOString();
  const todo = recipes.filter(r => !have.has(String(r.name).trim().toLowerCase()));
  console.log(`Existing recipes: ${existing.size}. In file: ${recipes.length}. To add: ${todo.length}.`);
  for (let i = 0; i < todo.length; i += 400) {
    const batch = db.batch();
    for (const r of todo.slice(i, i + 400)) {
      const { id, ...data } = r;
      batch.set(db.collection("recipes").doc(id), { ...data, photo_url: null, created_at: now, updated_at: now });
    }
    await batch.commit();
  }
  // ingredient renames requested by the owner (recipes + stock row); safe to run again
  const RENAMES = [{ from: "Short-grain rice (Sona Masoori OK)", to: "Sushi rice", unit: "cup", ko: "초밥용 쌀" }];
  const key = (item, unit) => String(item).trim().toLowerCase() + "|" + String(unit || "").trim().toLowerCase();
  for (const rn of RENAMES) {
    const all = await db.collection("recipes").get();
    let n = 0;
    for (const d of all.docs) {
      const ings = d.get("ingredients") || [];
      if (!ings.some(g => g.item === rn.from)) continue;
      await d.ref.update({ ingredients: ings.map(g => g.item === rn.from ? { ...g, item: rn.to } : g), updated_at: now });
      n++;
    }
    const oldRef = db.collection("inventory").doc(encodeURIComponent(key(rn.from, rn.unit)));
    const newRef = db.collection("inventory").doc(encodeURIComponent(key(rn.to, rn.unit)));
    const old = await oldRef.get();
    if (old.exists) {
      const cur = await newRef.get();
      await newRef.set({ ...(cur.exists ? cur.data() : {}), ...old.data(), item_key: key(rn.to, rn.unit), item: rn.to, ko: rn.ko, updated_at: now });
      await oldRef.delete();
    }
    console.log(`Renamed "${rn.from}" → "${rn.to}" in ${n} recipe(s)${old.exists ? " and the stock row" : ""}.`);
  }
  const after = await db.collection("recipes").get();
  const byCat = {};
  after.docs.forEach(d => { const c = d.get("category"); byCat[c] = (byCat[c] || 0) + 1; });
  console.log(`Done. Recipes now: ${after.size}`, JSON.stringify(byCat));
})().catch(e => { console.error(e.message || e); process.exit(1); });
