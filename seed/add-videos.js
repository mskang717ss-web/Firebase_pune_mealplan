// For every recipe without a video (and without its own photo), find an English YouTube recipe video
// (4–20 min, embeddable) and save it as video_url, so the card shows the video thumbnail.
// Uses the YouTube key the owner saved in the app (config/settings.ytKey). That key is restricted to the
// app's web addresses, so requests send the app address as Referer.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ projectId: process.env.PROJECT });
const db = getFirestore();
const REFERER = "https://pune-mealplan.web.app/";
const LIMIT = Number(process.env.LIMIT || 90); // each search costs 100 of the 10,000 daily YouTube units

(async () => {
  const set = await db.collection("config").doc("settings").get();
  const key = set.exists && set.get("ytKey");
  if (!key) throw new Error("No YouTube key saved in the app (People → YouTube video search).");
  const all = await db.collection("recipes").get();
  const todo = all.docs.filter(d => !d.get("video_url") && !d.get("photo_url")).slice(0, LIMIT);
  console.log(`Recipes: ${all.size}. Without video or photo: ${todo.length}.`);
  let done = 0;
  for (const d of todo) {
    const name = String(d.get("name") || "");
    const m = name.match(/^(.*?)\s*\((.+)\)\s*$/);           // "Gyeran-guk (Egg Drop Soup)"
    const q = m ? `${m[1]} ${m[2]} recipe` : `${name} recipe`;
    const korean = !/toast|pancake|oats|curd|avocado|peanut|sweet potato and|omelette with toast/i.test(name);
    const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&relevanceLanguage=en"
      + "&safeSearch=strict&videoEmbeddable=true&videoDuration=medium&q=" + encodeURIComponent((korean ? "korean " : "") + q) + "&key=" + encodeURIComponent(key);
    const res = await fetch(url, { headers: { Referer: REFERER } });
    const j = await res.json();
    if (j.error) { console.log(`STOP (${j.error.code}): ${j.error.message}`); break; }
    const it = (j.items || []).find(x => /^[A-Za-z0-9_-]{11}$/.test(x.id && x.id.videoId || ""));
    if (!it) { console.log(`-  ${name}: no video found`); continue; }
    await d.ref.update({ video_url: "https://www.youtube.com/watch?v=" + it.id.videoId, updated_at: new Date().toISOString() });
    done++;
    console.log(`✓  ${name}  →  ${it.snippet.title}  [${it.snippet.channelTitle}]`);
  }
  console.log(`Done. Videos added: ${done}.`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
