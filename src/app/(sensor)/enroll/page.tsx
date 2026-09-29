import { Fingerprint, Smartphone, UsbIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasskeyEnrol } from "@/components/passkey";
import { Alert } from "@/components/ui";
import { ANON, logEventSoft } from "@/lib/audit";
import { checkEnrolToken, getSensorUser } from "@/lib/repo/directory";

export const metadata: Metadata = { title: "Set up your passkey" };

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const t = await checkEnrolToken(token);
  const user = t ? await getSensorUser(t.userId) : null;
  await logEventSoft(user ? { type: "sensor", id: user._id, email: user.email } : ANON, "page.view", {
    result: user ? "ok" : "denied",
    meta: { path: "/enroll" },
  });

  if (!t || !user || user.status === "disabled") {
    return (
      <AuthShell title="This link has expired" subtitle="Enrolment links work once and expire after 72 hours.">
        <Alert tone="warning">Ask your administrator to send you a new link.</Alert>
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand">
          Already set up? Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Welcome, ${user.name.split(/\s+/)[0]}`} subtitle={<>Create a passkey for <strong className="text-fg">{user.email}</strong> to get started.</>}>
      <ul className="mb-6 space-y-3 text-sm text-fg-muted">
        <Step icon={<Smartphone className="size-4" />}>Use this phone or computer — it becomes your key.</Step>
        <Step icon={<Fingerprint className="size-4" />}>Confirm with your fingerprint, face or device PIN.</Step>
        <Step icon={<UsbIcon className="size-4" />}>Or use a hardware security key (e.g. YubiKey).</Step>
      </ul>
      <PasskeyEnrol token={token} />
    </AuthShell>
  );
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}
