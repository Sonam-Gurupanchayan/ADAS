"use client";

import { AlertTriangle, ChevronRight, PackageOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn, formatBytes, isRecent, relativeDate } from "@/lib/format";
import { SensorPhoto } from "./sensor-photo";
import { Badge, EmptyState } from "./ui";

export type LibraryItem = {
  id: string;
  title: string;
  version: string;
  modelIds: string[];
  publishedAt: string | null;
  size: number;
  issues: number;
  highIssues: number;
  supplier: string;
  image: string | null;
};

export function Library({ items, models }: { items: LibraryItem[]; models: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [latestOnly, setLatestOnly] = useState(true);
  const modelName = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m.name])), [models]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (model && !i.modelIds.includes(model)) return false;
      if (!needle) return true;
      return [i.title, i.version, i.supplier, ...i.modelIds.map((m) => modelName[m] ?? "")].join(" ").toLowerCase().includes(needle);
    });
    if (latestOnly && !needle) {
      // Keep only the newest release per model combination (items arrive newest first).
      const seen = new Set<string>();
      list = list.filter((i) => {
        const key = [...i.modelIds].sort().join("|") + "::" + i.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return list;
  }, [items, q, model, latestOnly, modelName]);

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 -mx-4 space-y-3 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search firmware, versions, models…"
            className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-10 text-[15px] shadow-sm placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
            aria-label="Search firmware"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-fg-subtle hover:text-fg" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!model} onClick={() => setModel(null)}>
            All models
          </Chip>
          {models.map((m) => (
            <Chip key={m.id} active={model === m.id} onClick={() => setModel(model === m.id ? null : m.id)}>
              {m.name}
            </Chip>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-line sm:block" />
          <Chip active={latestOnly} onClick={() => setLatestOnly((v) => !v)}>
            Latest only
          </Chip>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<PackageOpen className="size-6" />} title="No firmware available yet">
          When releases are published for your sensor models they&apos;ll appear here. If you expected to see something,
          ask your administrator to check your access.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="No matches">
          Try a different search or clear the model filter.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((i) => {
            const isNew = isRecent(i.publishedAt, 14);
            return (
              <li key={i.id}>
                <Link
                  href={`/firmware/${encodeURIComponent(i.id)}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md active:translate-y-0 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <SensorPhoto src={i.image} alt="" className="size-16 shrink-0 rounded-xl" iconClassName="size-6" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-semibold text-fg">{i.title}</h2>
                        {isNew && <Badge tone="brand">New</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-sm text-fg-muted">v{i.version}</p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {i.modelIds.map((m) => (
                      <Badge key={m}>{modelName[m] ?? m.replace(/^model:/, "")}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-fg-subtle">
                    <span className="truncate">
                      {i.supplier && <>{i.supplier} · </>}
                      {relativeDate(i.publishedAt)} · {formatBytes(i.size)}
                    </span>
                    {i.issues > 0 && (
                      <span className={cn("inline-flex shrink-0 items-center gap-1 font-medium", i.highIssues ? "text-danger" : "text-warning")}>
                        <AlertTriangle className="size-3.5" />
                        {i.issues} known {i.issues === 1 ? "issue" : "issues"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition",
        active ? "bg-fg text-bg shadow-sm" : "border border-line bg-surface text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
