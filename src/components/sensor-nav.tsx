"use client";

import { Library, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const items = [
  { href: "/", label: "Library", icon: Library, match: (p: string) => p === "/" || p.startsWith("/firmware") },
  { href: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
];

export function SensorNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  if (variant === "top") {
    return (
      <nav className="mr-2 hidden items-center gap-1 sm:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              i.match(path) ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/85 backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2">
        {items.map((i) => {
          const active = i.match(path);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-brand" : "text-fg-subtle")}
            >
              <i.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
