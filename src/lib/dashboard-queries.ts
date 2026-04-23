import { supabaseAdmin } from "@/lib/supabase-admin";

export interface DashboardStats {
  totalItems: number;
  ordersThisMonth: number;
  expiringSoon: number;
}

export interface ExpiringItem {
  id: number;
  item_number: string;
  lot_number: string;
  expiration_date: string;
  quantity_boxes: number;
}

export type ActivityKind = "order" | "receipt" | "usage";

export interface ActivityEntry {
  kind: ActivityKind;
  id: number;
  title: string;
  summary: string;
  at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = isoDate(now);
  const in30 = isoDate(new Date(now.getTime() + 30 * DAY_MS));

  const [items, orders, expiring] = await Promise.all([
    supabaseAdmin.from("item").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("purchase_order")
      .select("id", { count: "exact", head: true })
      .gte("date", startOfMonth),
    supabaseAdmin
      .from("receipt_line")
      .select("id", { count: "exact", head: true })
      .not("expiration_date", "is", null)
      .gte("expiration_date", today)
      .lte("expiration_date", in30),
  ]);

  return {
    totalItems: items.count ?? 0,
    ordersThisMonth: orders.count ?? 0,
    expiringSoon: expiring.count ?? 0,
  };
}

export async function getExpiringItems(limit = 5): Promise<ExpiringItem[]> {
  const now = new Date();
  const today = isoDate(now);
  const in30 = isoDate(new Date(now.getTime() + 30 * DAY_MS));

  const { data } = await supabaseAdmin
    .from("receipt_line")
    .select("id, item_number, lot_number, expiration_date, quantity_boxes")
    .not("expiration_date", "is", null)
    .gte("expiration_date", today)
    .lte("expiration_date", in30)
    .order("expiration_date", { ascending: true })
    .limit(limit);

  return (data ?? []) as ExpiringItem[];
}

type JoinedCompany = { name: string } | { name: string }[] | null;

function companyName(c: JoinedCompany): string {
  if (!c) return "Unknown supplier";
  if (Array.isArray(c)) return c[0]?.name ?? "Unknown supplier";
  return c.name;
}

export async function getRecentActivity(limit = 8): Promise<ActivityEntry[]> {
  const perSource = limit;
  const [orders, receipts, usages] = await Promise.all([
    supabaseAdmin
      .from("purchase_order")
      .select("id, date, created_at, company:company_id(name)")
      .order("created_at", { ascending: false })
      .limit(perSource),
    supabaseAdmin
      .from("receipt")
      .select("id, date, created_at, company:company_id(name)")
      .order("created_at", { ascending: false })
      .limit(perSource),
    supabaseAdmin
      .from("usage")
      .select("id, item_number, parts_used, date, created_at")
      .order("created_at", { ascending: false })
      .limit(perSource),
  ]);

  type OrderRow = {
    id: number;
    date: string;
    created_at: string;
    company: JoinedCompany;
  };
  type ReceiptRow = OrderRow;
  type UsageRow = {
    id: number;
    item_number: string;
    parts_used: number;
    date: string;
    created_at: string;
  };

  const merged: ActivityEntry[] = [
    ...((orders.data ?? []) as OrderRow[]).map((o) => ({
      kind: "order" as const,
      id: o.id,
      title: companyName(o.company),
      summary: `Order placed · ${o.date}`,
      at: o.created_at,
    })),
    ...((receipts.data ?? []) as ReceiptRow[]).map((r) => ({
      kind: "receipt" as const,
      id: r.id,
      title: companyName(r.company),
      summary: `Receipt logged · ${r.date}`,
      at: r.created_at,
    })),
    ...((usages.data ?? []) as UsageRow[]).map((u) => ({
      kind: "usage" as const,
      id: u.id,
      title: u.item_number,
      summary: `${u.parts_used} part${u.parts_used === 1 ? "" : "s"} used · ${u.date}`,
      at: u.created_at,
    })),
  ];

  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return merged.slice(0, limit);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

export function formatRelativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatDaysUntil(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diff = Math.round((then.getTime() - now.getTime()) / DAY_MS);
  if (diff <= 0) return "expires today";
  if (diff === 1) return "in 1 day";
  return `in ${diff} days`;
}
