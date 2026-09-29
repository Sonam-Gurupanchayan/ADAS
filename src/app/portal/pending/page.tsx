import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { logEventSoft } from "@/lib/audit";
import { currentOidc } from "@/lib/guards";

export const metadata: Metadata = { title: "Awaiting approval" };

export default async function PendingPage() {
  const ctx = await currentOidc();
  if (!ctx) redirect("/portal/signin");
  if (ctx.oem?.status === "active" && ctx.oem.orgId) redirect("/portal");
  await logEventSoft(ctx.actor, "page.view", { meta: { path: "/portal/pending", status: ctx.oem?.status } });

  async function out() {
    "use server";
    await signOut({ redirectTo: "/portal/signin" });
  }

  const disabled = ctx.oem?.status === "disabled";
  return (
    <AuthShell
      title={disabled ? "Account disabled" : "Awaiting approval"}
      subtitle={
        disabled
          ? "Your supplier account has been disabled. Contact the platform administrator if you think this is a mistake."
          : "Thanks for signing in. An administrator needs to link your account to your company before you can upload firmware."
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-surface-2 p-4 text-sm">
        <Clock className="size-5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="truncate font-medium">{ctx.session.user.name}</p>
          <p className="truncate text-fg-muted">{ctx.session.user.email}</p>
        </div>
      </div>
      <form action={out}>
        <Button variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthShell>
  );
}
