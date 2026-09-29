import type { ReactNode } from "react";
import { Logo } from "./brand";

/** Centered card over an atmospheric background, used for sign-in and enrolment. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-brand/15 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 size-[520px] rounded-full bg-brand-2/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--line)_1px,transparent_0)] [background-size:24px_24px] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-7 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-fg-muted">{subtitle}</div>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 max-w-sm text-center text-xs text-fg-subtle">{footer}</div>}
    </div>
  );
}
