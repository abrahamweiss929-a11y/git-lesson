import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Icon, { type IconName } from "@/components/ui/Icon";
import {
  getDashboardStats,
  getExpiringItems,
  getRecentActivity,
  greeting,
  formatRelativeTime,
  formatDaysUntil,
  type ActivityKind,
} from "@/lib/dashboard-queries";

export const dynamic = "force-dynamic";

interface StatDef {
  label: string;
  value: number | string;
  color: "teal" | "amber" | "rose";
  icon: IconName;
  href: string;
}

const activityIcon: Record<ActivityKind, IconName> = {
  order: "orders",
  receipt: "receipts",
  usage: "usage",
};

const activityColor: Record<ActivityKind, "teal" | "emerald" | "violet"> = {
  order: "teal",
  receipt: "emerald",
  usage: "violet",
};

const activityBg: Record<ActivityKind, string> = {
  order: "bg-teal-50 text-teal-600",
  receipt: "bg-emerald-50 text-emerald-600",
  usage: "bg-violet-50 text-violet-600",
};

const activityHref: Record<ActivityKind, string> = {
  order: "/orders",
  receipt: "/receipts",
  usage: "/usage",
};

export default async function Home() {
  const [stats, expiring, activity] = await Promise.all([
    getDashboardStats(),
    getExpiringItems(5),
    getRecentActivity(8),
  ]);

  const statCards: StatDef[] = [
    {
      label: "Active items",
      value: stats.totalItems.toLocaleString(),
      color: "teal",
      icon: "package",
      href: "/items",
    },
    {
      label: "Orders this month",
      value: stats.ordersThisMonth.toLocaleString(),
      color: "amber",
      icon: "orders",
      href: "/orders",
    },
    {
      label: "Expiring < 30 days",
      value: stats.expiringSoon.toLocaleString(),
      color: "rose",
      icon: "clock",
      href: "/receipts",
    },
  ];

  const hasActivity = activity.length > 0;
  const hasExpiring = expiring.length > 0;

  return (
    <div className="px-8 py-8 max-w-[1400px]">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 mb-8 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0F766E 0%, #0D9488 40%, #F59E0B 120%)",
        }}
      >
        <div
          className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative">
          <Badge color="amber">
            <span className="text-white/90">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight leading-tight">
            {greeting()}
          </h2>
          <p className="mt-3 text-white/80 text-sm max-w-lg">
            Record orders, receipts, and usage — or ask a question about your
            inventory.
          </p>
          <div className="mt-6 flex gap-3 flex-wrap">
            <Link
              href="/orders"
              className="bg-white text-teal-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <Icon name="plus" size={16} /> New Order
            </Link>
            <Link
              href="/ask"
              className="bg-white/10 backdrop-blur text-white border border-white/20 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Icon name="sparkle" size={16} /> Ask anything
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.05)] p-5 hover:border-slate-300 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  s.color === "teal"
                    ? "bg-teal-50 text-teal-600"
                    : s.color === "amber"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-rose-50 text-rose-600"
                }`}
              >
                <Icon name={s.icon} size={18} />
              </div>
              <Icon
                name="arrow"
                size={14}
                className="text-slate-300 group-hover:text-slate-500 transition-colors"
              />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Activity feed + expiring items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card padded={false} className="h-full">
            <div className="flex items-center justify-between p-6 pb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Recent activity</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest orders, receipts, and usage
                </p>
              </div>
            </div>
            {hasActivity ? (
              <div className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <Link
                    key={`${a.kind}-${a.id}`}
                    href={activityHref[a.kind]}
                    className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activityBg[a.kind]}`}
                    >
                      <Icon name={activityIcon[a.kind]} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {a.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {a.summary}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 shrink-0 pt-0.5 tabular-nums">
                      {formatRelativeTime(a.at)}
                    </div>
                    <Badge color={activityColor[a.kind]} className="shrink-0 capitalize">
                      {a.kind}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-6 pb-6 text-sm text-slate-500">
                No activity yet. Record an order, receipt, or usage entry to get
                started.
              </div>
            )}
          </Card>
        </div>

        <Card padded={false}>
          <div className="p-6 pb-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <Icon name="warning" size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">Expiring soon</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Within 30 days
              </div>
            </div>
          </div>
          {hasExpiring ? (
            <div className="divide-y divide-slate-100">
              {expiring.map((x) => (
                <div
                  key={x.id}
                  className="px-6 py-3 flex items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {x.item_number}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Lot {x.lot_number} · {x.quantity_boxes} box
                      {x.quantity_boxes === 1 ? "" : "es"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-rose-700 tabular-nums">
                      {formatDaysUntil(x.expiration_date)}
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {x.expiration_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 pb-6 text-sm text-slate-500">
              Nothing expires in the next 30 days.
            </div>
          )}
          {stats.expiringSoon > expiring.length && (
            <div className="px-6 py-3 border-t border-slate-100">
              <Link
                href="/receipts"
                className="text-sm text-rose-700 font-medium hover:text-rose-800 flex items-center gap-1"
              >
                See all {stats.expiringSoon} <Icon name="arrow" size={12} />
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
