import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lab Inventory",
  description: "Lab inventory data entry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <Topbar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
