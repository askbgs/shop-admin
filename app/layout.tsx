import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shop Admin',
  description: 'Order dashboard for the WhatsApp clothing shop',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
