-- Epic 7: Marketplace listings, purchases, Stripe event idempotency

create table if not exists marketplace_listings (
  id                uuid primary key default gen_random_uuid(),
  graph_id          uuid not null references public.graphs(id) on delete cascade,
  author_id         uuid not null references auth.users(id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 100),
  description       text not null check (char_length(description) <= 2000),
  price_cents       int  not null default 0 check (price_cents >= 0),
  category          text not null default 'general',
  tags              text[] not null default '{}',
  stripe_product_id text default '',
  stripe_price_id   text default '',
  is_published      bool not null default true,
  install_count     int  not null default 0,
  search_vector     tsvector,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Full-text search index
create index if not exists marketplace_listings_fts_idx
  on marketplace_listings using gin (search_vector);
create index if not exists marketplace_listings_author_idx
  on marketplace_listings (author_id);
create index if not exists marketplace_listings_category_idx
  on marketplace_listings (category) where is_published = true;

-- Function: populate search vector on insert/update
create or replace function marketplace_listings_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'C');
  return new;
end;
$$;

-- Triggers: drop first so re-running the migration is safe
drop trigger if exists marketplace_listings_search_vector_trigger on marketplace_listings;
create trigger marketplace_listings_search_vector_trigger
  before insert or update on marketplace_listings
  for each row execute function marketplace_listings_search_vector_update();

drop trigger if exists marketplace_listings_updated_at on marketplace_listings;
create trigger marketplace_listings_updated_at
  before update on marketplace_listings
  for each row execute function public.set_updated_at();

-- Purchases table
create table if not exists purchases (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references marketplace_listings(id),
  buyer_id          uuid not null references auth.users(id) on delete cascade,
  cloned_graph_id   uuid references public.graphs(id) on delete set null,
  stripe_session_id text default '',
  created_at        timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index if not exists purchases_buyer_idx on purchases (buyer_id);

-- Stripe event idempotency table
create table if not exists stripe_events (
  stripe_event_id text primary key,
  type            text not null,
  processed_at    timestamptz not null default now()
);

-- RLS (drop first for idempotency)
alter table marketplace_listings enable row level security;

drop policy if exists "Public can read published listings" on marketplace_listings;
create policy "Public can read published listings"
  on marketplace_listings for select
  using (is_published = true);

drop policy if exists "Authors manage own listings" on marketplace_listings;
create policy "Authors manage own listings"
  on marketplace_listings for all
  using (auth.uid() = author_id);

alter table purchases enable row level security;

drop policy if exists "Buyers see own purchases" on purchases;
create policy "Buyers see own purchases"
  on purchases for select
  using (auth.uid() = buyer_id);

drop policy if exists "Service role inserts purchases" on purchases;
create policy "Service role inserts purchases"
  on purchases for insert
  with check (true);
