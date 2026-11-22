-- Weekly Meal Plan — Supabase schema snapshot (2026-11-22, app v1.14)
-- Project: weekly-meal-plan (ref sqnuivviqajivhjtsaxn, org MSKang, region ap-south-1)
-- Reference only: this is a reconstruction of what is live. Do NOT re-run on the live project.

-- ===== Tables =====
create table public.meal_admins (            -- the single owner (first account to sign in)
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.meal_editors (           -- invited members (owner manages via "People")
  email text primary key check (email = lower(email)),
  label text,
  added_at timestamptz not null default now()
);
create table public.meal_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- "Korean name (English)" convention
  category text not null default 'Main',     -- Breakfast|Main|Soup & Stew|Side|Rice & Noodles|Snack|Other
  servings integer not null default 1 check (servings > 0),
  prep_min integer, cook_min integer,
  ingredients jsonb not null default '[]',   -- [{item, qty, unit, cat (SHOP_CATS), staple:boolean}]
  steps jsonb not null default '[]',         -- ["step 1", ...]
  notes text,
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  video_url text check (video_url is null or video_url ~ '^https://'),  -- English YouTube video
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.meal_entries (           -- one dish in one day/slot
  id uuid primary key default gen_random_uuid(),
  meal_date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid references public.meal_recipes(id) on delete set null,
  title text,                                -- free-text dish when recipe_id is null
  servings integer check (servings is null or servings > 0),
  note text, sort integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.meal_week_notes (week_start date primary key, note text, updated_at timestamptz not null default now());
create table public.meal_shopping_extras (
  id uuid primary key default gen_random_uuid(), week_start date not null,
  item text not null, qty text, category text not null default 'Others', created_at timestamptz not null default now()
);
create table public.meal_shopping_checks (
  week_start date not null, item_key text not null check (char_length(item_key) <= 200),
  checked boolean not null default false, updated_at timestamptz not null default now(),
  primary key (week_start, item_key)
);
create table public.meal_inventory (         -- stock at home; one row per item_key
  item_key text primary key,                 -- "item|unit" (lowercase) or "s|item" for staples
  item text not null, unit text,
  category text not null default 'Others'
    check (category in ('Vegetables','Fruits','Meat & Eggs','Dairy & Bakery','Grains','Korean Pantry','Others')),
  is_staple boolean not null default false,  -- staples use status ok|low|out instead of qty
  qty numeric check (qty is null or (qty >= 0 and qty < 100000)),
  status text check (status is null or status in ('ok','low','out')),
  counted_at timestamptz not null default now(),  -- meals after this are auto-deducted
  par numeric,                               -- "keep at least" level
  photo_url text,
  updated_at timestamptz not null default now()
);
-- RLS is ENABLED on every table above.

-- ===== Helper functions (all SECURITY DEFINER, search_path '') =====
-- is_meal_owner(): caller is in meal_admins
-- is_meal_admin(): owner OR (confirmed auth.users email in meal_editors)   <- every policy uses this
-- meal_role():     'viewer' (no session) | 'owner' | 'editor' | 'none'
-- meal_has_admin(): owner exists? (anon may call; used by the login screen)
-- claim_meal_admin(): if no owner yet, the caller becomes owner
-- set_meal_inventory(p_key,p_item,p_unit,p_category,p_staple,p_qty,p_status,p_recount)  (members only)
-- set_meal_inventory_par(p_key,p_item,p_unit,p_category,p_par)                         (members only)
-- set_meal_shopping_check(p_week,p_key,p_checked)                                       (members only)

-- ===== Policies =====
-- meal_recipes / meal_entries / meal_week_notes / meal_shopping_extras / meal_shopping_checks / meal_inventory:
--   "members read" SELECT to authenticated using (is_meal_admin())
--   "admin insert/update/delete" to authenticated using/check (is_meal_admin())
-- meal_editors: select/insert/update/delete to authenticated only when is_meal_owner()
-- meal_admins:  "admins read self" SELECT to authenticated using (user_id = auth.uid())
-- anon has NO table access (revoked). Only meal_has_admin() is callable by anon.

-- ===== Storage =====
-- bucket recipe-photos (public read by URL); insert/update/delete only when is_meal_admin().
-- paths: recipes/<uuid>.jpg, items/<item_key-slug>.jpg  (client shrinks to 1280px JPEG)
