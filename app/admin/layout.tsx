import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { AuroraBackground } from '@/components/aurora-background';
import '../globals.css';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Admin · Chenyliao',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontSans.variable} min-h-screen font-sans antialiased`}>
      <ThemeProvider>
        <AuroraBackground />
        {children}
      </ThemeProvider>
    </div>
  );
}
