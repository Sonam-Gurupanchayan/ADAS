"use client";

import { CheckCircle2, CloudUpload, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatBytes } from "@/lib/format";
import type { FirmwareFile } from "@/lib/types";
import { Alert, Button } from "./ui";

export function FirmwareUpload({ id, file, editable, maxBytes }: { id: string; file: FirmwareFile | null; editable: boolean; maxBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  function upload(f: File) {
    setError(null);
    if (f.size > maxBytes) return setError(`That file is ${formatBytes(f.size)} — the limit is ${formatBytes(maxBytes)}.`);
    if (f.size === 0) return setError("That file is empty.");
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/oem/firmware/${encodeURIComponent(id)}/file`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(f.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) router.refresh();
      else {
        try {
          setError(JSON.parse(xhr.responseText).error);
        } catch {
          setError(`Upload failed (${xhr.status}).`);
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };
    setProgress(0);
    xhr.send(f);
  }

  const busy = progress !== null;

  return (
    <div className="space-y-3">
      {file && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-fg-muted">{formatBytes(file.size)}</p>
            <p className="mt-1 break-all font-mono text-xs text-fg-subtle">sha256 {file.sha256}</p>
          </div>
        </div>
      )}
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) upload(f);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${drag ? "border-brand bg-brand/5" : "border-line"}`}
        >
          {busy ? (
            <div className="space-y-3">
              <p className="flex items-center justify-center gap-2 text-sm font-medium">
                <Loader2 className="size-4 animate-spin" /> Uploading… {progress}%
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <CloudUpload className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-2 text-sm text-fg-muted">
                Drop the firmware image here, or{" "}
                <button type="button" onClick={() => input.current?.click()} className="font-medium text-brand hover:underline">
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-fg-subtle">Up to {formatBytes(maxBytes)}{file ? " · replaces the current file" : ""}</p>
            </>
          )}
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

export function SubmitForReview({ action, disabled }: { action: () => Promise<{ error?: string; ok?: string } | undefined>; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | undefined>();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          start(async () => {
            setMsg(await action());
            router.refresh();
          })
        }
        disabled={disabled || pending}
        className="w-full"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit for review
      </Button>
      {msg?.error && <Alert tone="danger">{msg.error}</Alert>}
    </div>
  );
}
