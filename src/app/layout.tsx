import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pogo PVP Pro — Build Better Battle Teams",
  description: "A focused Pokémon GO PvP roster manager, appraisal importer, and league-aware team builder.",
  applicationName: "Pogo PVP Pro",
};

export const viewport = {
  themeColor: "#070d16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
