"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import Logo from "@/components/Logo";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

const workspaceItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "home" },
  { label: "Companies", href: "/companies", icon: "building" },
  { label: "Orders", href: "/orders", icon: "orders" },
  { label: "Receipts", href: "/receipts", icon: "receipts" },
  { label: "Usage", href: "/usage", icon: "usage" },
  { label: "Item Master", href: "/items", icon: "items" },
];

const askItem: NavItem = { label: "Ask", href: "/ask", icon: "ask" };

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const askActive = isActive(askItem.href, pathname);

  return (
    <aside className="w-64 shrink-0 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 flex flex-col h-screen sticky top-0 z-30">
      <Link
        href="/"
        className="px-5 py-5 flex items-center gap-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
      >
        <Logo size={38} />
        <div className="min-w-0">
          <div className="font-bold text-white text-lg tracking-tight leading-none">
            Lab Inventory
          </div>
          <div className="text-[11px] text-teal-300/70 mt-1 tracking-wide uppercase">
            Operations
          </div>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          Workspace
        </div>
        {workspaceItems.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-teal-600/90 to-teal-500/60 text-white shadow-[0_4px_12px_-4px_rgba(13,148,136,0.5)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          Intelligence
        </div>
        <Link
          href={askItem.href}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            askActive
              ? "bg-gradient-to-r from-amber-500/90 to-amber-400/70 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)]"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
          aria-current={askActive ? "page" : undefined}
        >
          <Icon name="ask" size={18} />
          <span className="truncate">Ask</span>
          {!askActive && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
              AI
            </span>
          )}
        </Link>
      </nav>
    </aside>
  );
}
