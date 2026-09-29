"use client";

import { useActionState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button } from "./ui";

type State = { error?: string; ok?: string } | undefined;

/** Small wrapper for admin server-action forms with inline success/error feedback. */
export function ActionForm({
  action,
  children,
  submit = "Save",
  variant = "primary",
  className,
  inline = false,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children?: ReactNode;
  submit?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success";
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={cn(inline ? "flex flex-wrap items-center gap-2" : "space-y-4", className)}>
      {children}
      <div className={cn("flex items-center gap-3", !inline && "justify-end")}>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.ok && !pending && <span className="text-sm text-success">{state.ok}</span>}
        <Button type="submit" variant={variant} size={inline ? "sm" : "md"} disabled={pending}>
          {pending ? "Saving…" : submit}
        </Button>
      </div>
    </form>
  );
}
