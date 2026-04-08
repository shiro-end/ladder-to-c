import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ladder to C Converter",
  description: "PLCラダー図PDFをC言語コードに変換するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
