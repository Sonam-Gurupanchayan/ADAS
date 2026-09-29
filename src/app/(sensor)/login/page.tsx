import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PasskeyLogin } from "@/components/passkey";
import { logEventSoft, ANON } from "@/lib/audit";
import { currentSensor } from "@/lib/guards";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(n: string | undefined) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentSensor()) redirect(next);
  await logEventSoft(ANON, "page.view", { meta: { path: "/login" } });

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the passkey on your phone, computer or security key."
      footer={
        <>
          Don&apos;t have access? Ask your administrator for an invite.
          <br />
          Firmware supplier?{" "}
          <Link href="/portal" className="font-medium text-fg-muted underline underline-offset-2 hover:text-fg">
            Go to the supplier portal
          </Link>
        </>
      }
    >
      <PasskeyLogin next={next} />
      <p className="mt-5 flex items-start gap-2 text-xs text-fg-subtle">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        Two-factor by design: your device plus your fingerprint, face or PIN. No passwords to leak.
      </p>
    </AuthShell>
  );
}
