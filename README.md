# Weekly Meal Plan

Members-only weekly meal plan, stock & shopping list and recipes for a home kitchen (owner + maid).

- Live: `https://pune-mealplan.web.app` (also `https://meal-plan-e954d.web.app`), Firebase Hosting (deploys from `main` via GitHub Actions)
- Backend: Firebase (Auth: Google + email/password, Firestore; photos stored in Firestore)
- Single file app: `index.html` (vanilla JS + Firebase JS SDK compat v13)
- Old backend (Supabase, up to v1.14) kept read-only until the switch is confirmed.

See `CLAUDE.md` for architecture, conventions and open tasks.
