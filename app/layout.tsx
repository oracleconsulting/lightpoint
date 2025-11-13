import { TRPCProvider } from '@/lib/trpc/Provider';
import { UserProvider } from '@/contexts/UserContext';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lightpoint - HMRC Complaint Management',
  description: 'Privacy-first HMRC complaint management system for accountants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}

