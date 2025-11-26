import type { Metadata } from 'next';
import { Navigation } from './components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hustle Bot',
  description: 'Automated lead generation and outreach system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className='antialiased min-h-screen flex'>
        <Navigation />
        <main className='flex-1 ml-64 min-h-screen bg-black'>{children}</main>
      </body>
    </html>
  );
}
