import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { CrtOverlay } from '@/components/ui/crt-overlay';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shussei',
  description: 'Comunicação privada em tempo real para o time.',
};

export const viewport: Viewport = {
  themeColor: '#0a0705',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
        <CrtOverlay />
      </body>
    </html>
  );
}
