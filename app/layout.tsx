import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSTDREAM — draw your app, export a verified deployable project',
  description:
    'Visually design an AWS/SST v4 or Vercel app, simulate the wiring, and export clean, verified, type-checked, deployable files. No AI, no credentials — it runs in your browser.',
  openGraph: {
    title: 'SSTDREAM — visual SST v4 / Vercel architecture builder',
    description:
      'Draw your app. Simulate it. Export a verified, type-checked, deployable project. Zero AI, zero hallucinated APIs.',
    type: 'website',
  },
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem('sstdream.theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
