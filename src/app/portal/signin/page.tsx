import { LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Button } from "@/components/ui";
import { ANON, logEventSoft } from "@/lib/audit";
import { currentOidc } from "@/lib/guards";

export const metadata: Metadata = { title: "Supplier sign in" };

function safe(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/portal";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = safe(sp.callbackUrl);
  if (await currentOidc()) redirect(callbackUrl);
  await logEventSoft(ANON, "page.view", { meta: { path: "/portal/signin", error: sp.error } });

  async function go() {
    "use server";
    await signIn("oidc", { redirectTo: callbackUrl });
  }

  return (
    <AuthShell
      title="Supplier portal"
      subtitle="Firmware suppliers and administrators sign in with your organisation account."
      footer={
        <>
          Downloading firmware for sensors?{" "}
          <Link href="/login" className="font-medium text-fg-muted underline underline-offset-2 hover:text-fg">
            Sign in to the firmware library
          </Link>
        </>
      }
    >
      {sp.error && (
        <div className="mb-4">
          <Alert tone="danger">Sign-in failed ({sp.error}). Please try again.</Alert>
        </div>
      )}
      <form action={go}>
        <Button size="lg" className="w-full">
          <LogIn className="size-5" /> Continue with {process.env.OIDC_DISPLAY_NAME || "single sign-on"}
        </Button>
      </form>
    </AuthShell>
  );
}
