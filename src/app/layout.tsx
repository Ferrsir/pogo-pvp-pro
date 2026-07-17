import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pogo PVP Pro — Build Better Battle Teams",
  description: "A private Pokémon GO PvP roster manager with cloud-saved collections, trainer accounts, and league-aware team building.",
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
