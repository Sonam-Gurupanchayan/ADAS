import { cn } from "@/lib/format";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-fg", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-brand to-brand-2 shadow-sm shadow-brand/30">
        <span className="grid size-4 place-items-center rounded-[5px] border-2 border-white">
          <span className="size-1.5 rounded-full bg-white" />
        </span>
      </span>
      Firmware Hub
    </span>
  );
}
