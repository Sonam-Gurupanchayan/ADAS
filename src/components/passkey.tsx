"use client";

import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, startRegistration, WebAuthnAbortService } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Button } from "./ui";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

function friendly(e: unknown) {
  const err = e as Error & { name?: string };
  if (err?.name === "NotAllowedError") return "The passkey prompt was cancelled or timed out.";
  if (err?.name === "InvalidStateError") return "This device already has a passkey for your account.";
  if (err?.name === "AbortError") return null;
  return err?.message || "Something went wrong";
}

function useWebAuthnSupport() {
  // null during SSR; the real answer once running in the browser.
  return useSyncExternalStore<boolean | null>(
    () => () => {},
    () => browserSupportsWebAuthn(),
    () => null,
  );
}

export function PasskeyLogin({ next }: { next: string }) {
  const router = useRouter();
  const supported = useWebAuthnSupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run(useBrowserAutofill: boolean) {
    setError(null);
    if (!useBrowserAutofill) setBusy(true);
    try {
      const optionsJSON = await post<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/sensor/webauthn/login-options");
      const response = await startAuthentication({ optionsJSON, useBrowserAutofill });
      setBusy(true);
      await post("/api/sensor/webauthn/login-verify", { response });
      router.replace(next);
      router.refresh();
    } catch (e) {
      const msg = friendly(e);
      if (msg) setError(msg);
      setBusy(false);
    }
  }

  // Conditional UI: offer passkeys in the username field's autofill as soon as the page loads.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    browserSupportsWebAuthnAutofill().then((ok) => {
      if (ok) void run(true);
    });
    return () => WebAuthnAbortService.cancelCeremony();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (supported === false) {
    return <Alert tone="warning">This browser doesn&apos;t support passkeys. Try an up-to-date Safari, Chrome, Edge or Firefox.</Alert>;
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        name="username"
        autoComplete="username webauthn"
        placeholder="Email (optional)"
        aria-label="Email"
        className="sr-only"
        tabIndex={-1}
      />
      <Button size="lg" className="w-full" onClick={() => run(false)} disabled={busy}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Fingerprint className="size-5" />}
        {busy ? "Verifying…" : "Sign in with passkey"}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

export function PasskeyEnrol({ token }: { token: string }) {
  const router = useRouter();
  const supported = useWebAuthnSupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/sensor/webauthn/register-options", { token });
      const response = await startRegistration({ optionsJSON });
      await post("/api/sensor/webauthn/register-verify", { response });
      router.replace("/?welcome=1");
      router.refresh();
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }

  if (supported === false) {
    return <Alert tone="warning">This browser doesn&apos;t support passkeys. Open the link in an up-to-date Safari, Chrome, Edge or Firefox.</Alert>;
  }
  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <KeyRound className="size-5" />}
        {busy ? "Follow the prompt on your device…" : "Create my passkey"}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

export function AddPasskey() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const optionsJSON = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/sensor/webauthn/register-options", {});
      const response = await startRegistration({ optionsJSON });
      await post("/api/sensor/webauthn/register-verify", { response });
      setMsg({ tone: "success", text: "Passkey added." });
      router.refresh();
    } catch (e) {
      const text = friendly(e);
      if (text) setMsg({ tone: "danger", text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add another passkey
      </Button>
      {msg && (
        <Alert tone={msg.tone}>
          {msg.tone === "success" && <ShieldCheck className="mr-1 inline size-4" />}
          {msg.text}
        </Alert>
      )}
    </div>
  );
}

export function SensorSignOut({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/sensor/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
