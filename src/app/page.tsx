import Link from "next/link";

const sections = [
  {
    href: "/companies",
    title: "Companies",
    description: "Manage supplier companies",
  },
  {
    href: "/orders",
    title: "Orders",
    description: "Record purchase orders",
  },
  {
    href: "/receipts",
    title: "Receipts",
    description: "Log received shipments",
  },
  {
    href: "/usage",
    title: "Usage",
    description: "Track parts used",
  },
  {
    href: "/items",
    title: "Item Master",
    description: "Define items and supplier codes",
  },
];

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Lab Inventory</h1>
      <p className="text-gray-600 mb-8">
        Data entry for orders, receipts, and usage tracking.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <h2 className="font-semibold text-gray-900">{s.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
