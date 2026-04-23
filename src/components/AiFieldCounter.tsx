import Icon from "@/components/ui/Icon";

interface AiFieldCounterProps {
  count: number;
}

export default function AiFieldCounter({ count }: AiFieldCounterProps) {
  if (count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <Icon name="sparkle" size={12} className="text-amber-500" />
      {count} field{count !== 1 ? "s" : ""} filled by AI — review optional
    </div>
  );
}
