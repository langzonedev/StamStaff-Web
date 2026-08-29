import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import RegisterServiceWorker from './register-service-worker';

const sans = DM_Sans({ variable: '--font-sans', subsets: ['latin'] });
const display = Fraunces({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StamStaff — Reserve your next shift',
  description: 'A fictional interactive prototype for simple event availability and rostering.',
  applicationName: 'StamStaff',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'StamStaff',
    description: 'Reserve a place. Manager confirms.',
    type: 'website',
    images: [{ url: '/og.png', width: 1536, height: 864, alt: 'StamStaff — Reserve a place. Manager confirms.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StamStaff',
    description: 'Reserve a place. Manager confirms.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body className={`${sans.variable} ${display.variable}`}>{children}<RegisterServiceWorker /></body></html>;
}
