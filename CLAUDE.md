# CLAUDE.md — Weekly Meal Plan (주간식단표)

Handoff from the claude.ai session on 2026-11-22. The current version is **v2.07** (backend on Firebase since v2.00). Read this file first.

## 1. What this is
- A members-only web app used by the owner (Minseong Kang) and his maid in Pune. It manages the weekly meal plan, stock/shopping and recipes.
- **The UI must be English only**, because the maid reads English. `<html lang="en" translate="no">` stops Chrome from auto-translating the page. Do not remove it.
- The owner talks to Claude in **Korean**. Reply to him in Korean and keep the app text in English.

## 2. Files
| File | Purpose |
|---|---|
| `index.html` | The whole app: HTML + CSS + JS (~1,100 lines). This is what gets deployed. |
| `firestore.rules` | Firestore security rules (deployed with hosting by the workflow) |
| `firebase.json`, `.firebaserc` | Hosting (publishes `_site/` = copy of `index.html`), rules, emulator ports. `.firebaserc` holds the project id. |
| `.github/workflows/firebase-deploy.yml` | On push to `main`: deploy hosting + rules. Needs repo secret `FIREBASE_SERVICE_ACCOUNT` (service-account JSON). Skips if missing. |
| `supabase-schema.sql` | Old Supabase DB snapshot (v1.x). Legacy reference only. |
| `(C)_*.json` | Local data exports — git-ignored, never commit (public repo). |
| `README.md` | Short summary |

## 3. Infrastructure
- **Firebase** (v2.00+): project `meal-plan-e954d` (`FB_CONFIG` in `index.html`, `.firebaserc`), web app "Pune Meal Plan". Spark (free) plan. Firestore location `asia-south1`.
  - Hosting: **`https://pune-mealplan.web.app`** (main address) and `https://meal-plan-e954d.web.app`; both get the same `index.html` (targets `pune` / `main` in `.firebaserc`). The workflow creates the `pune-mealplan` site and adds it to Auth authorized domains if missing.
  - Auth providers: Google, Email/Password. Add any extra domain (e.g. a custom domain) to Auth → Settings → Authorized domains.
  - The web config (apiKey etc.) is public by design; security comes from `firestore.rules`.
- **Repo**: `mskang717ss-web/meal-plan` (Public). Never commit secrets or data exports.
- **Old stack (v1.x, retire after the switch)**: Cloudflare Pages `zgdi-mealplan.pages.dev` (also auto-builds `main`), GitHub Pages, Supabase project `weekly-meal-plan` (ref `sqnuivviqajivhjtsaxn`). Data was exported 2026-11-22 to `(C)_Weekly_Meal_Plan_data_2026-11-22.json` (14 recipes, 31 entries, 8 stock items, 0 photos).
- **Google Drive**: old folder "02. 주간식단표" (id `1dL8BCN1cH4fI-IfE9CPabDs0XS6A3Z8p`); new folder "3. Mealplan_Firebase" (id `19IHQvjj8oRZYT-4PPUx4HyBuc3rw6mek`) holds the v2.00 HTML and the data export.

## 4. Access model (security)
- **Before sign-in, only the login screen (`#gate`) is shown.** `#app` stays hidden.
- Firestore collections: `config/owner` {uid,email}, `editors/{lowercase email}`, `recipes`, `entries`, `weekNotes/{week_start}`, `shopExtras`, `shopChecks/{enc(week|key)}`, `inventory/{enc(item_key)}`, `photos`.
- Roles (enforced in `firestore.rules`):
  - `owner`: the first account with a **verified email** that signs in creates `config/owner` (create-only; change it in the console if ever needed).
  - `editor`: verified email listed in `editors` (owner manages it in **People**).
  - Owner and editors have the same data rights. Only the owner reads/writes `editors`.
  - Signed-out users and unlisted/unverified accounts can read nothing.
- Email/password sign-up sends a verification email; the gate shows "Confirm your email" until verified. Google accounts are verified automatically.
- Sessions persist (Firebase default local persistence). Firestore offline cache is on (`enablePersistence`).

## 5. Code map (`index.html`)
- Constants: `SLOTS`, `CATS` (recipe categories), `SHOP_CATS` (Vegetables, Fruits, Meat & Eggs, Dairy & Bakery, Grains, Korean Pantry, Others), `DAYS` (**week starts on Sunday**; `mondayOf()` actually returns that Sunday)
- Firebase: `FB_CONFIG`, `auth`, `fs`, helpers `C(name)`, `docs()`, `kid()` (doc id from item key), `tryDo()`, `eMsg()`. `?emu=1` on localhost uses the local emulators.
- State object `S`: tab, week, recipes, rmap, entries, allEntries, inv, rows, isAdmin, isOwner, role, pick, user, …
- Data: `loadRecipes`, `loadWeek` (entries from today−120 days up to the end of the week, for stock deduction), `loadAll`, `refreshWeek`
- Auth: `auth.onAuthStateChanged` → `boot()` → `refreshAuth()` → app or `renderGate()` (sign-in / confirm email / no access). People: `openTeam()`
- Photos: `savePhoto(file,maxPx)` shrinks to JPEG (<~600 KB data URL) and stores it in `photos/{id}`; fields hold `fs:<id>`. `imgSrc()` + `hydratePhotos()` (MutationObserver) load them lazily, from cache first. Recipes 1000 px, stock items 500 px.
- One-time import: owner sees "Import data from the old app" on the Recipes tab while there are no recipes → `importData()`.
- Plan tab: `renderPlan`, `cellHtml`, `chipHtml`, `paletteWrap` ("2. All dishes"); tap-to-place (`S.pick`), drag-and-drop, `openAddEntry` picture picker, weekend classes `sun`/`sat` (`wkc()`)
- Stock tab: `renderShop`, `allStockItems`, `attachInv`, `usedBetween`, `buildNeeds`, `saveInv` (Have = counted − eaten since `counted_at`; Need = remaining meals; Buy = Need + keep − Have, rounded up for `COUNT_UNITS`; Bought adds to stock; staples Enough/Low/Out; `addRowHtml`/`addToGroup`, `openItemEdit` — edits also update the recipes using the item)
- Gemini: `fillWithGemini()`, `geminiJSON()` call `firebasevertexai.googleapis.com/v1beta/projects/<id>/models/<model>:generateContent` with the Firebase web apiKey (AI Logic, Gemini Developer API backend; owner must enable AI Logic in the console). Models tried in order: `AI_MODELS`. JSON output via `RECIPE_SCHEMA`; existing stock names are sent so names/units match. Video → recipe: `aiRecipe(name,videoUrl)` sends the YouTube URL as `fileData` (fallback: title + description text). UI: `finderHtml`/`searchDishes`/`makeFromVideo` on the Recipes tab; `fillForm()` fills the open editor; `saveRecipe` calls Gemini first when only a video link is given.
- YouTube finder: `findVideos()` searches YouTube Data API v3 with the key the owner saves in People (`config/settings.ytKey`, members read, owner writes); without a key it opens a YouTube search tab. Auto-runs when a dish name is entered and no link is set.
- Recipes tab: `renderRecipes`, `openRecipe`, `openRecipeEdit`, `saveRecipe`; photo priority: own photo → YouTube thumbnail (`photoOf`) → emoji; "Watch the video on YouTube (English)" button.

## 6. Conventions (owner's rules)
- **Version display**: top right of the page and on the login card: `Weekly Meal Plan | vX.XX | Updated YYYY-MM-DD`. Bump both places (search for the current `vX.XX`) on every release. Use two decimals: v2.07 → v2.08.
- Files handed to the owner are named `(C)_Weekly_Meal_Plan_vX.XX.html`. The repo keeps `index.html`.
- Keep it a single self-contained HTML file with no build step.
- Mobile matters, because the maid uses a phone. Check a 390 px viewport. Mobile shows day cards (`.daycards`) and stock cards.
- The owner prefers concise Korean replies, conclusion first, and tables.
- **Every reply to the owner includes the app link** https://pune-mealplan.web.app (and any other relevant link: GitHub run, console page, Drive folder).

## 7. Testing
- Use the Firebase emulators (real rules): `firebase emulators:start --only auth,firestore --project demo-mealplan` (needs Java), then open `http://localhost:<port>/?emu=1` with Playwright.
  - Serve the Firebase compat SDK files from `node_modules/firebase/` by routing `https://cdn.jsdelivr.net/**`.
  - Verify emails through `GET http://127.0.0.1:9099/emulator/v1/projects/demo-mealplan/oobCodes` and open each `oobLink`.
  - Cover: first verified account → owner, import, recipe photo, stock save, People → editor access, stranger/unverified/signed-out denied.
- Check the JS syntax quickly with `node -e "new Function(<script body>)"`. Check a 390 px viewport.
- Never put real credentials in tests.

## 8. Open tasks (as of 2026-11-22)
1. DONE 2026-11-22: Firebase project, web app, Auth (Google + Email/Password), Firestore, owner signed in, data imported, YouTube key saved. TODO (owner): add the maid in **People**; enable **AI Logic → Gemini Developer API** in the Firebase console (Gemini features fail until then; real Gemini calls not yet verified).
2. **Deploy key**: Project settings → Service accounts → Generate new private key → GitHub repo Settings → Secrets → Actions → `FIREBASE_SERVICE_ACCOUNT` (paste the whole JSON). Claude must never see or handle the key. DONE 2026-11-22: the `firebase-adminsdk-fbsvc@meal-plan-e954d` account needed the extra IAM roles **Firebase Admin** and **Service Usage Consumer** (also has Hosting Admin) before deploys worked.
3. DONE 2026-11-22: merged to `main`, first deploy succeeded (hosting + rules). Next: Owner signs in first (becomes owner), imports the JSON on the Recipes tab, adds the maid in **People**, updates the maid's bookmark.
4. After it works: retire Cloudflare Pages / GitHub Pages / Supabase (pause or delete the project).
5. Weekly Drive backup into "3. Mealplan_Firebase" (not set up yet; needs a way to read Firestore, e.g. an owner-only "Export" button or a scheduled job with credentials).

## 9. Version history
v1.00 first · v1.01 new Supabase project · v1.02 block auto-translate · v1.03 Sunday start · v1.04 stock/shopping, recipe photos · v1.05 auto-tracked stock, item photos · v1.06 picture menu, fruit category · v1.07 stock/need on one row · v1.08 mobile readability · v1.09 mobile stock cards, round up · v1.10 All dishes drag, keep(par) · v1.11 tap-to-place from All dishes · v1.12 editor accounts (People) · v1.13 members-only login gate, persistent session, weekend colours, column lines, inline stock add/edit/delete, Watermelon, YouTube videos + thumbnails · v1.14 "Continue with Google" button (appears once provider enabled) · v2.00 backend moved to Firebase (Auth + Firestore + Hosting), photos in Firestore, email verification, forgot password, one-time import ·  v2.01 plan grid: dish names no longer overflow at medium widths (photo on top, name below) · v2.02 stock item Edit: name/unit/category editable even when used in recipes (changes are written into those recipes) · v2.03 plan grid chips same height (2-line name, 1-line subtitle) · v2.04 YouTube "Find video" in recipe editor (key in People → config/settings), stock Need + keep on one line · v2.05 Gemini recipes (Firebase AI Logic) · v2.06 Recipes tab "Add a new dish": search YouTube → ✨ Make recipe (Gemini watches the video); Save with only a video link lets Gemini fill the recipe; Korean names shown after stock item names (`KO` dictionary, Gemini `ko`, editable in Edit item); plan chips aligned (fixed 62px, photo + text centred) · v2.07 clearer message when Gemini (AI Logic) is off
