import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hustle Bot",
  description: "Automated lead generation and outreach system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
