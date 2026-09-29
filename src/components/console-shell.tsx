import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { Logo } from "./brand";
import { ConsoleNav, type NavItem } from "./console-nav";
import { ThemeToggle } from "./theme";

// Dense, desktop-first shell for the OEM supplier portal and the admin console.
export function ConsoleShell({
  area,
  nav,
  user,
  children,
}: {
  area: string;
  nav: NavItem[];
  user: { name?: string | null; email?: string | null; isAdmin: boolean };
  children: ReactNode;
}) {
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/portal/signin" });
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-surface lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-16 lg:px-5">
          <Link href={nav[0]?.href ?? "/"} className="flex items-center gap-2">
            <Logo />
          </Link>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{area}</span>
        </div>
        <ConsoleNav items={nav} />
        <div className="hidden border-t border-line p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-fg-subtle">{user.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              {user.isAdmin && area !== "Admin" && (
                <Link href="/admin" className="font-medium text-brand hover:underline">
                  Admin
                </Link>
              )}
              {area === "Admin" && (
                <Link href="/portal" className="font-medium text-brand hover:underline">
                  Supplier portal
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <form action={doSignOut}>
                <button className="rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mt-10 flex items-center justify-between border-t border-line pt-4 text-xs text-fg-subtle lg:hidden">
          <span className="truncate">{user.email}</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={doSignOut}>
              <button className="rounded-lg px-2 py-1.5 font-medium hover:bg-surface-2 hover:text-fg">Sign out</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
