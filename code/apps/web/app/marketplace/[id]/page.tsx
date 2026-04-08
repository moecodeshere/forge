import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

async function getListing(id: string) {
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
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*, users(email, full_name)")
      .eq("id", id)
      .eq("is_published", true)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const author = listing.users as { email?: string; full_name?: string } | null;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href="/marketplace" className="text-sm text-slate-500 hover:text-slate-800">
            ← Marketplace
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-700 dark:text-slate-300">{listing.title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {listing.category}
              </span>
              {listing.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {listing.title}
            </h1>

            <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
              <span>By {author?.full_name ?? author?.email ?? "Unknown"}</span>
              <span>⬇ {listing.install_count} installs</span>
              <span>{new Date(listing.created_at as string).toLocaleDateString()}</span>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 font-semibold text-slate-800 dark:text-slate-200">
                Description
              </h2>
              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {listing.price_cents === 0
                    ? "Free"
                    : `$${(listing.price_cents / 100).toFixed(2)}`}
                </div>
                {listing.price_cents > 0 && (
                  <p className="mt-1 text-xs text-slate-400">one-time payment</p>
                )}
              </div>

              <InstallButton
                listingId={id}
                isFree={listing.price_cents === 0}
                priceDisplay={
                  listing.price_cents === 0
                    ? "Free"
                    : `$${(listing.price_cents / 100).toFixed(2)}`
                }
              />

              <p className="mt-3 text-center text-xs text-slate-400">
                Installed as a copy in your graphs
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InstallButton({
  listingId,
  isFree,
  priceDisplay,
}: {
  listingId: string;
  isFree: boolean;
  priceDisplay: string;
}) {
  return (
    <form
      action={`/api/marketplace/${listingId}/install`}
      method="POST"
    >
      <button
        type="submit"
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        {isFree ? "Install Free" : `Buy for ${priceDisplay}`}
      </button>
    </form>
  );
}
