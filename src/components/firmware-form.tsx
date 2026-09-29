"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/portal/actions";
import type { KnownIssue, Severity } from "@/lib/types";
import { Alert, Button, Field, Input, Select, Textarea } from "./ui";

type Initial = {
  title: string;
  version: string;
  modelIds: string[];
  releaseNotes: string;
  installationNotes: string;
  knownIssues: KnownIssue[];
};

export const EMPTY_FIRMWARE: Initial = { title: "", version: "", modelIds: [], releaseNotes: "", installationNotes: "", knownIssues: [] };

export function FirmwareForm({
  action,
  initial,
  models,
  submitLabel,
  readOnly = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: Initial;
  models: { id: string; name: string }[];
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [issues, setIssues] = useState<KnownIssue[]>(initial.knownIssues);

  const setIssue = (i: number, patch: Partial<KnownIssue>) => setIssues((all) => all.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  return (
    <form action={formAction} className="space-y-6">
      <fieldset disabled={readOnly || pending} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Release title" htmlFor="title">
            <Input id="title" name="title" defaultValue={initial.title} placeholder="e.g. Radar front-end stability update" required />
          </Field>
          <Field label="Version" htmlFor="version">
            <Input id="version" name="version" defaultValue={initial.version} placeholder="2.4.1" className="font-mono" required />
          </Field>
        </div>

        <Field label="Applicable sensor models" hint="Only sensor users with access to these models will see this release.">
          {models.length === 0 ? (
            <Alert tone="warning">No sensor models are assigned to your organisation yet. Ask an administrator to add them.</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm transition has-[:checked]:border-brand has-[:checked]:bg-brand/5"
                >
                  <input type="checkbox" name="modelIds" value={m.id} defaultChecked={initial.modelIds.includes(m.id)} className="size-4 accent-[var(--brand)]" />
                  {m.name}
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field label="Release notes" htmlFor="releaseNotes" hint="Markdown supported.">
          <Textarea id="releaseNotes" name="releaseNotes" defaultValue={initial.releaseNotes} rows={8} placeholder={"## What's new\n- …"} />
        </Field>

        <Field label="Installation notes" htmlFor="installationNotes" hint="Prerequisites, steps, and how to verify. Markdown supported.">
          <Textarea id="installationNotes" name="installationNotes" defaultValue={initial.installationNotes} rows={8} placeholder={"1. Connect to the sensor service port\n2. …"} />
        </Field>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Known issues</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIssues((a) => [...a, { title: "", severity: "medium", workaround: "" }])}>
              <Plus className="size-4" /> Add issue
            </Button>
          </div>
          {issues.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-fg-subtle">No known issues.</p>}
          {issues.map((issue, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-4 sm:grid-cols-[1fr_140px_auto]">
              <Input value={issue.title} onChange={(e) => setIssue(i, { title: e.target.value })} placeholder="Issue summary" aria-label="Issue summary" />
              <Select value={issue.severity} onChange={(e) => setIssue(i, { severity: e.target.value as Severity })} aria-label="Severity">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
              <Button type="button" variant="ghost" onClick={() => setIssues((a) => a.filter((_, n) => n !== i))} aria-label="Remove issue">
                <Trash2 className="size-4" />
              </Button>
              <Textarea
                value={issue.workaround}
                onChange={(e) => setIssue(i, { workaround: e.target.value })}
                placeholder="Workaround (optional)"
                rows={2}
                className="min-h-0 sm:col-span-3"
                aria-label="Workaround"
              />
            </div>
          ))}
          <input type="hidden" name="knownIssues" value={JSON.stringify(issues)} />
        </div>
      </fieldset>

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
