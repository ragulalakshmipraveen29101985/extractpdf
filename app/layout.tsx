import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice PDF → Excel",
  description: "POC: extract invoice PDFs with OpenAI and download as Excel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
