import { ImageResponse } from 'next/og';
import { getProfile } from '@/lib/content';

// Render on-demand: avoids file-system font loading during static export and
// keeps the OG image fresh whenever profile data changes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Personal site';

export default async function OG() {
  const profile = await getProfile();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#0f172a',
          background:
            'radial-gradient(circle at 18% 22%, rgba(59,130,246,0.28) 0%, transparent 56%),' +
            'radial-gradient(circle at 82% 28%, rgba(56,189,248,0.22) 0%, transparent 58%),' +
            'radial-gradient(circle at 64% 84%, rgba(125,211,252,0.26) 0%, transparent 56%),' +
            'linear-gradient(180deg, #f8fbff 0%, #eef7ff 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: '#0f172a',
            }}
          >
            {profile.handle}.dev
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: '#0f62fe',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {profile.role.en}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
              color: '#0f172a',
            }}
          >
            {profile.nameZh} · {profile.nameEn}
          </div>
          <div style={{ fontSize: 32, color: '#475569', maxWidth: 980, lineHeight: 1.3 }}>
            {profile.slogan.zh}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#475569',
          }}
        >
          <div>{profile.slogan.en}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {profile.socials.slice(0, 3).map((s) => (
              <span key={s.type}>{s.type}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
