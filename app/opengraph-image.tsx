import { ImageResponse } from 'next/og';

// Self-dogfooded social card — generated with `next/og`, the exact API the Vercel
// lane's OG Image kind emits. Prerendered to a PNG at build (static export).
export const alt = 'SSTDREAM — draw your app, export verified SST v4 / Vercel, deploy it yourself';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Prerender to a static PNG at build time (required by output: 'export').
export const dynamic = 'force-static';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: '-0.03em' }}>SSTDREAM</div>
      <div style={{ fontSize: 38, marginTop: 18, color: '#a3a3a3', maxWidth: 900 }}>
        Draw your app. Export verified SST v4 / Vercel. Deploy it yourself.
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
        {['No AI calls', 'Type-checked', 'Doc-verified', '50 kinds · 2 lanes'].map((t) => (
          <div
            key={t}
            style={{
              display: 'flex',
              fontSize: 26,
              color: '#34d399',
              border: '1px solid #262626',
              borderRadius: 14,
              padding: '10px 20px',
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
