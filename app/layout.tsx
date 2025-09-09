import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "AI Study Support",
  description: "AIを活用した学習サポートアプリ",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
