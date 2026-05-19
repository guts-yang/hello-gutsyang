import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, JetBrains_Mono, Ma_Shan_Zheng } from 'next/font/google';
import './globals.css';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'opsz'],
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Ma Shan Zheng is a Chinese-only brush-script font; Google only exposes the
// `latin` subset key, but next/font downloads the full unicode-range woff2
// (including U+4E00–9FFF CJK Unified) so 廖晨扬 actually hits the brush face.
const fontName = Ma_Shan_Zheng({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-name',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a14' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Chenyliao',
  description: 'Personal site of Chenyliao.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} ${fontName.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
