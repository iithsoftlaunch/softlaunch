import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans, Space_Mono } from 'next/font/google';
import './globals.css';
import { SITE } from '@/lib/site';
import PurposeBar from '@/components/purpose-bar';
import CursorGlow from '@/components/cursor-glow';
import Interactive from '@/components/interactive';
import RevealController from '@/components/reveal-controller';
import ScrollProgress from '@/components/scroll-progress';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument',
  display: 'swap',
});
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${SITE.name} · ${SITE.campus} Prom`,
  description:
    'Soft launch your crush. Secretly pick up to three people and find out only if it is mutual. Private even from us.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${fraunces.variable} ${instrument.variable} ${spaceMono.variable}`}
    >
      <body>
        <ScrollProgress />
        <CursorGlow />
        <Interactive />
        <RevealController />
        <PurposeBar />
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
