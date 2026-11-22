# CLAUDE.md — Weekly Meal Plan (주간식단표)

Handoff from the claude.ai session on 2026-11-22. The current version is **v1.14**. Read this file first.

## 1. What this is
- A members-only web app used by the owner (Minseong Kang) and his maid in Pune. It manages the weekly meal plan, stock/shopping and recipes.
- **The UI must be English only**, because the maid reads English. `<html lang="en" translate="no">` stops Chrome from auto-translating the page. Do not remove it.
- The owner talks to Claude in **Korean**. Reply to him in Korean and keep the app text in English.

## 2. Files
| File | Purpose |
|---|---|
| `index.html` | The whole app: HTML + CSS + JS (~1,050 lines). This is what gets deployed. |
| `supabase-schema.sql` | Snapshot of the live DB (tables, functions, policies). Reference only. Do not re-run it. |
| `README.md` | Short summary |

## 3. Infrastructure
- **Hosting**: Cloudflare Pages project `zgdi-mealplan` → https://zgdi-mealplan.pages.dev. It auto-builds on every push to `main` (about 40 s, no build step). GitHub Pages also serves the same file.
- **Repo**: `mskang717ss-web/meal-plan` (Public). Never commit secrets. The Supabase publishable key in `index.html` is meant to be public.
- **Supabase**: org MSKang (Free), project `weekly-meal-plan`, ref `sqnuivviqajivhjtsaxn`, region ap-south-1
  - URL `https://sqnuivviqajivhjtsaxn.supabase.co`, publishable key is already in `index.html`
  - Auth → Site URL `https://zgdi-mealplan.pages.dev/`, Redirect URLs `https://zgdi-mealplan.pages.dev/**` and `https://mskang717ss-web.github.io/meal-plan/**`
  - Free plan: max 2 active projects per account (1 used). A project pauses after 7 days with no activity.
- **Google Drive backup**: folder "02. 주간식단표" (id `1dL8BCN1cH4fI-IfE9CPabDs0XS6A3Z8p`). It holds Google Sheets of recipes, meals and stock from 2026-11-22 plus the HTML file. No automatic backup is set up.

## 4. Access model (security)
- **Before sign-in, only the login screen (`#gate`) is shown.** `#app` stays hidden.
- On the DB side, anon cannot read or write any table. Only `meal_has_admin()` is callable by anon.
- Roles:
  - `owner`: the first account that signs in (`claim_meal_admin()`)
  - `editor`: an email the owner added in **People** (`meal_editors`). The account's email must be confirmed.
  - Owner and editors have the same rights. Only the owner can manage People.
  - Every RLS policy uses `is_meal_admin()`.
- Sessions persist: `persistSession:true` and `autoRefreshToken:true`. Sign-in is needed once per device.
- Email/password sign-up is open, but an account that is not on the list sees the "No access yet" screen.
- **Google sign-in**: the "Continue with Google" button appears only when `GET /auth/v1/settings` returns `external.google === true`. The Google provider is **not configured yet**. See section 8.

## 5. Code map (`index.html`)
- Constants: `SLOTS`, `CATS` (recipe categories), `SHOP_CATS` (Vegetables, Fruits, Meat & Eggs, Dairy & Bakery, Grains, Korean Pantry, Others), `DAYS` (**week starts on Sunday**; `mondayOf()` actually returns that Sunday)
- State object `S`: tab, week, recipes, rmap, entries, allEntries, inv, rows, isAdmin, isOwner, role, pick, …
- Data: `loadRecipes`, `loadWeek` (entries from today−120 days up to the end of the week, for stock deduction), `loadAll`, `refreshWeek`
- Auth: `boot()` → `refreshAuth()` → shows the app or `renderGate()`. People manager: `openTeam()`
- Plan tab: `renderPlan`, `cellHtml`, `chipHtml`, `paletteWrap` ("2. All dishes")
  - Tap a dish, then tap a cell to place it (`S.pick`, capture-phase click handler)
  - Drag-and-drop also works
  - `openAddEntry` = picture picker
  - Weekend columns use classes `sun` / `sat` (`wkc()`)
- Stock tab: `renderShop`, `allStockItems`, `attachInv`, `usedBetween`, `buildNeeds`, `saveInv`
  - Have = counted qty − meals eaten since `counted_at`
  - Need = remaining meals this week
  - Buy = Need + keep(par) − Have, rounded up for `COUNT_UNITS`
  - Ticking Bought adds the bought amount to stock
  - Staples use Enough / Low / Out
  - Inline add per category: `addRowHtml` / `addToGroup`. Edit/Delete: `openItemEdit` (name and unit are locked when a recipe uses the item)
- Recipes tab: `renderRecipes`, `openRecipe`, `openRecipeEdit`, `saveRecipe`
  - Photo priority: uploaded `photo_url`, then the YouTube thumbnail from `video_url` (`photoOf`), then an emoji
  - The recipe card has a "Watch the video on YouTube (English)" button. With no `video_url`, it links to a YouTube search.
- Photos are shrunk with `shrinkImage()` to 1280 px JPEG before upload to the `recipe-photos` bucket.

## 6. Conventions (owner's rules)
- **Version display**: top right of the page and on the login card: `Weekly Meal Plan | vX.XX | Updated YYYY-MM-DD`. Bump both places (search for `v1.14`) on every release. Use two decimals: v1.14 → v1.15.
- Files handed to the owner are named `(C)_Weekly_Meal_Plan_vX.XX.html`. The repo keeps `index.html`.
- Keep it a single self-contained HTML file with no build step.
- Mobile matters, because the maid uses a phone. Check a 390 px viewport. Mobile shows day cards (`.daycards`) and stock cards.
- The owner prefers concise Korean replies, conclusion first, and tables.

## 7. Testing
- Use Playwright (headless Chromium) against `file://…/index.html` with **mocked Supabase routes** (`page.route("**/*", …)`).
  - Fulfil `/rest/v1/meal_*`, `/rpc/*` and `/auth/v1/settings` with JSON fixtures.
  - Serve supabase-js UMD locally from `node_modules/@supabase/supabase-js/dist/umd/supabase.js` instead of the CDN.
- To simulate a signed-in member, after load run `S.session={user:{email:'a@b.c'}};S.isAdmin=true;S.isOwner=true;` show `#app`, then `loadAll()`.
- Check the JS syntax quickly with `node -e "new Function(<script body>)"`.
- Never put real credentials in tests.

## 8. Open tasks (as of 2026-11-22)
1. **The owner account does not exist yet.** The owner must sign in first; the first account becomes owner. Then add the maid's email in **People**.
2. **Google sign-in setup.** The owner wants to register with his Google account. The secret must be entered by the owner, never by Claude.
   - In Google Cloud Console: create a project → OAuth consent screen (External, then **Publish app**)
   - Credentials → OAuth client ID (Web)
     - JS origin: `https://zgdi-mealplan.pages.dev`
     - Redirect: `https://sqnuivviqajivhjtsaxn.supabase.co/auth/v1/callback`
   - Supabase → Authentication → Sign In / Providers → Google → paste the Client ID and Secret
   - The button then appears on its own (no code change needed).
3. Optional: a weekly Drive backup (Sheets) scheduled task. It was not set up.
4. **Option B, under consideration**: migrate the backend to Firebase.
   - Firestore + Firebase Auth (Google sign-in is a single toggle) + Hosting
   - Note: Cloud Storage for Firebase needs the Blaze plan (card on file; free quota still applies), which is needed for photos. Set a budget alert.
   - Work involved: replace every `sb.from/rpc/storage` call, re-create RLS as Firestore rules, move the stock RPCs into client or rule logic, migrate the data (small).
   - Get the owner's go-ahead before starting.

## 9. Version history
v1.00 first · v1.01 new Supabase project · v1.02 block auto-translate · v1.03 Sunday start · v1.04 stock/shopping, recipe photos · v1.05 auto-tracked stock, item photos · v1.06 picture menu, fruit category · v1.07 stock/need on one row · v1.08 mobile readability · v1.09 mobile stock cards, round up · v1.10 All dishes drag, keep(par) · v1.11 tap-to-place from All dishes · v1.12 editor accounts (People) · v1.13 members-only login gate, persistent session, weekend colours, column lines, inline stock add/edit/delete, Watermelon, YouTube videos + thumbnails · v1.14 "Continue with Google" button (appears once provider enabled)
