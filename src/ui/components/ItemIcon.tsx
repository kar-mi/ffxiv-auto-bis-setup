export function ItemIcon({
  src,
  className = "",
}: {
  src: string | null | undefined;
  className?: string;
}) {
  if (!src) return <div class={`w-10 h-10 rounded bg-ffxiv-border ${className}`} />;
  return (
    <img
      src={src}
      alt=""
      class={`w-10 h-10 rounded object-cover ${className}`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}
