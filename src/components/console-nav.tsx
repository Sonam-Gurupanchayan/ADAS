"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

export type NavItem = { href: string; label: string; badge?: number };

export function ConsoleNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => {
    // Longest matching prefix wins so /admin/firmware doesn't also light up /admin.
    const matches = items.filter((i) => path === i.href || path.startsWith(i.href + "/"));
    const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
    return best?.href === href;
  };
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:px-3 lg:pb-0 lg:pt-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
            active(i.href) ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {i.label}
          {!!i.badge && <span className="rounded-full bg-warning/15 px-1.5 text-xs font-semibold text-warning">{i.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
