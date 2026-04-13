interface AiFieldCounterProps {
  count: number;
}

export default function AiFieldCounter({ count }: AiFieldCounterProps) {
  if (count === 0) return null;

  return (
    <p className="text-sm text-gray-500">
      <span className="mr-1">&#10024;</span>
      {count} field{count !== 1 ? "s" : ""} filled by AI &mdash; review
      optional
    </p>
  );
}
