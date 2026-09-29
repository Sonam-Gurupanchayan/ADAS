import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { SensorNav } from "@/components/sensor-nav";
import { ThemeToggle } from "@/components/theme";
import { currentSensor } from "@/lib/guards";

export default async function SensorLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentSensor();
  if (!ctx) redirect("/login");
  const initials = ctx.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Firmware library">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <SensorNav variant="top" />
            <ThemeToggle />
            <Link
              href="/profile"
              className="ml-1 grid size-9 place-items-center rounded-full bg-gradient-to-br from-brand/20 to-brand-2/20 text-xs font-semibold text-brand ring-1 ring-brand/25"
              aria-label="Your profile"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10">{children}</main>
      <SensorNav variant="bottom" />
    </div>
  );
}
