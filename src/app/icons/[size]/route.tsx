import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

// App icon rendered on demand (PWA manifest, apple-touch-icon, favicon).
// Full-bleed background keeps it safe as a maskable icon.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  const size = SIZES.has(n) ? n : 192;
  const s = size / 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f766e 0%, #0e7490 100%)",
        }}
      >
        <div
          style={{
            width: 84 * s,
            height: 84 * s,
            borderRadius: 18 * s,
            border: `${7 * s}px solid white`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 30 * s, height: 30 * s, borderRadius: 999, background: "white" }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
