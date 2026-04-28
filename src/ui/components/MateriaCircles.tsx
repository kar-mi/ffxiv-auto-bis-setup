import type { EquipmentPiece } from "../../types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";

export function MateriaCircles({ piece, itemDataMap }: { piece: EquipmentPiece; itemDataMap: Map<number, ItemData> }) {
  const totalSlots = piece.canOvermeld ? 5 : Math.min(piece.materiaSlots ?? 2, 2);
  return (
    <div class="flex gap-1 items-center mt-1">
      {Array.from({ length: totalSlots }, (_, i) => {
        const id = piece.materias[i] ?? 0;
        const filled = id !== 0;
        const isOvermeld = i >= 2;
        const title = filled ? (itemDataMap.get(id)?.name ?? `Materia #${id}`) : undefined;
        if (!filled) {
          const border = isOvermeld ? "border-red-800" : "border-blue-800";
          return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full border ${border} flex-shrink-0 inline-block`} />;
        }
        const bg = isOvermeld ? "bg-red-500" : "bg-blue-400";
        return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full ${bg} flex-shrink-0 inline-block`} />;
      })}
    </div>
  );
}
