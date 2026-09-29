import { redirect } from "next/navigation";
import { ConsoleShell } from "@/components/console-shell";
import { currentOidc } from "@/lib/guards";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentOidc();
  if (!ctx) redirect("/portal/signin");
  if (!ctx.oem || ctx.oem.status !== "active" || !ctx.oem.orgId) redirect(ctx.isAdmin ? "/admin" : "/portal/pending");
  return (
    <ConsoleShell
      area="Supplier"
      user={{ name: ctx.session.user.name, email: ctx.session.user.email, isAdmin: ctx.isAdmin }}
      nav={[
        { href: "/portal", label: "My firmware" },
        { href: "/portal/firmware/new", label: "New release" },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
