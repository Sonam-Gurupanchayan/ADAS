import { redirect } from "next/navigation";
import { ConsoleShell } from "@/components/console-shell";
import { currentOidc } from "@/lib/guards";
import { listFirmwareByStatus } from "@/lib/repo/firmware";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentOidc();
  if (!ctx) redirect("/portal/signin?callbackUrl=/admin");
  if (!ctx.isAdmin) redirect("/portal");
  const pending = await listFirmwareByStatus("pending");
  return (
    <ConsoleShell
      area="Admin"
      user={{ name: ctx.session.user.name, email: ctx.session.user.email, isAdmin: true }}
      nav={[
        { href: "/admin/review", label: "Review queue", badge: pending.length },
        { href: "/admin/firmware", label: "All firmware" },
        { href: "/admin/sensor-users", label: "Sensor users" },
        { href: "/admin/groups", label: "Access groups" },
        { href: "/admin/models", label: "Sensor models" },
        { href: "/admin/orgs", label: "Organisations" },
        { href: "/admin/oem-users", label: "Supplier accounts" },
        { href: "/admin/audit", label: "Audit log" },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
