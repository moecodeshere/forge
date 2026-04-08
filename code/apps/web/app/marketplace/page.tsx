import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface Listing {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  tags: string[];
  install_count: number;
  created_at: string;
}

async function getListings(search?: string, category?: string): Promise<Listing[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    );
    let query = supabase
      .from("marketplace_listings")
      .select("id, title, description, price_cents, category, tags, install_count, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (category && category !== "all") query = query.eq("category", category);

    const { data } = await query;
    return (data as Listing[]) ?? [];
  } catch {
    return [];
  }
}

const categories = ["all", "general", "productivity", "data", "coding", "research", "customer-support"];

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const listings = await getListings(params.q, params.category);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Workflow Marketplace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Discover and install community AI workflows
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <form className="flex-1" method="GET">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search workflows…"
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </form>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/marketplace?category=${cat}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  (params.category ?? "all") === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ")}
              </Link>
            ))}
          </div>
        </div>

        {/* Grid */}
        {listings.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-4xl">🛒</p>
            <p className="mt-3 font-medium">No workflows yet</p>
            <p className="mt-1 text-sm">Be the first to publish!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100">
          {listing.title}
        </h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {listing.category}
        </span>
      </div>
      <p className="mb-3 line-clamp-2 text-sm text-slate-500">{listing.description}</p>
      {listing.tags?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {listing.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>⬇ {listing.install_count} installs</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {listing.price_cents === 0
            ? "Free"
            : `$${(listing.price_cents / 100).toFixed(2)}`}
        </span>
      </div>
    </Link>
  );
}
