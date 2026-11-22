// Adds the recipes from seed/recipes80.json to Firestore, skipping names that already exist.
// Run by .github/workflows/seed-recipes.yml (service account via GOOGLE_APPLICATION_CREDENTIALS).
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp({ projectId: process.env.PROJECT });
const db = admin.firestore();

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
  const after = await db.collection("recipes").get();
  const byCat = {};
  after.docs.forEach(d => { const c = d.get("category"); byCat[c] = (byCat[c] || 0) + 1; });
  console.log(`Done. Recipes now: ${after.size}`, JSON.stringify(byCat));
})().catch(e => { console.error(e.message || e); process.exit(1); });
