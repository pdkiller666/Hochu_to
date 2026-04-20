import { useState, ReactNode } from "react";
import { Map as MapIcon, ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleMapProps {
  /** Заголовок справа от иконки в свёрнутом состоянии */
  label?: string;
  /** Подсказка под кнопкой когда карта закрыта */
  hint?: string;
  /** Открыта ли карта по умолчанию */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Сворачиваемая обёртка для любой карты.
 * Когда карта свёрнута — она физически не смонтирована (Leaflet корректно очистится).
 * При повторном открытии маркер/координаты восстанавливаются из props родителя.
 */
export function CollapsibleMap({
  label = "Карта",
  hint,
  defaultOpen = false,
  children,
}: CollapsibleMapProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <MapIcon className="w-4 h-4 text-primary" />
          {label}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          {open ? "Скрыть" : "Показать"}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {!open && hint && (
        <p className="text-xs text-muted-foreground px-1">{hint}</p>
      )}

      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
