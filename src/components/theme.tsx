"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const order = ["system", "light", "dark"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; render the neutral icon on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? ((theme as (typeof order)[number]) ?? "system") : "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(order[(order.indexOf(current) + 1) % order.length])}
      className="grid size-9 place-items-center rounded-xl text-fg-muted transition hover:bg-surface-2 hover:text-fg"
      aria-label={`Theme: ${current}. Click to change.`}
      title={`Theme: ${current}`}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
