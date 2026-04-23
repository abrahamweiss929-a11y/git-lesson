"use client";

import { usePathname } from "next/navigation";

interface PageMeta {
  title: string;
  subtitle?: string;
}

const routeMeta: Array<{ match: (path: string) => boolean; meta: PageMeta }> = [
  {
    match: (p) => p === "/",
    meta: { title: "Dashboard", subtitle: "Overview of your lab inventory" },
  },
  {
    match: (p) => p === "/companies" || p.startsWith("/companies/"),
    meta: { title: "Companies", subtitle: "Manage supplier companies" },
  },
  {
    match: (p) => p === "/orders" || p.startsWith("/orders/"),
    meta: {
      title: "New Order",
      subtitle: "Upload a PDF or enter manually",
    },
  },
  {
    match: (p) => p === "/receipts" || p.startsWith("/receipts/"),
    meta: { title: "Receipts", subtitle: "Log received shipments" },
  },
  {
    match: (p) => p === "/usage" || p.startsWith("/usage/"),
    meta: {
      title: "Record Usage",
      subtitle: "Parts used — last 48 hours shown below",
    },
  },
  {
    match: (p) => p === "/items" || p.startsWith("/items/"),
    meta: {
      title: "Item Master",
      subtitle: "Items, supplier codes, and prices",
    },
  },
  {
    match: (p) => p === "/ask" || p.startsWith("/ask/"),
    meta: {
      title: "Ask",
      subtitle: "Natural-language queries over your inventory",
    },
  },
];

function metaFor(pathname: string): PageMeta {
  return (
    routeMeta.find((r) => r.match(pathname))?.meta ?? { title: "Lab Inventory" }
  );
}

export default function Topbar() {
  const pathname = usePathname();
  const { title, subtitle } = metaFor(pathname);

  return (
    <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
      <div className="px-8 h-[72px] flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  );
}
