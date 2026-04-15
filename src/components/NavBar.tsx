"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/companies", label: "Companies" },
  { href: "/orders", label: "Orders" },
  { href: "/receipts", label: "Receipts" },
  { href: "/usage", label: "Usage" },
  { href: "/items", label: "Item Master" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 flex items-center h-14 gap-1 overflow-x-auto">
        <Link href="/" className="font-semibold text-gray-900 mr-4 shrink-0">
          Lab Inventory
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 rounded-md text-sm font-medium shrink-0 ${
              (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href))
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
