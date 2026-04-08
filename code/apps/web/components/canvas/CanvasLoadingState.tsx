import { Skeleton } from "@/components/ui/skeleton";

export function CanvasLoadingState() {
  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950 text-zinc-100">
      <div className="flex flex-1 min-h-0">
        <aside className="flex w-52 flex-col border-r border-zinc-900 bg-zinc-950/95 p-4">
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </aside>
        <div className="relative flex flex-1 flex-col">
          <div className="flex h-12 items-center justify-between border-b border-zinc-900 px-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-900">
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <Skeleton className="mx-auto mb-2 h-4 w-40" />
              <Skeleton className="mx-auto h-3 w-56" />
            </div>
          </div>
        </div>
      </div>
      <div className="h-[220px] shrink-0 border-t border-zinc-900 bg-zinc-950 p-4">
        <Skeleton className="mb-2 h-4 w-16" />
        <Skeleton className="h-20 w-full rounded" />
      </div>
    </div>
  );
}
