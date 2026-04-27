import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";

/**
 * Stage 29 — Trust Score badge.
 *
 * Цветовая шкала (брендовая палитра «Хочу_То»):
 *   ≥ 80 — зелёный  (#4A8587, бирюза бренда) — «Высокий уровень доверия»
 *   50–79 — жёлтый  (amber-100/700)         — «Средний уровень»
 *   < 50  — красный (#C65D3B, акцент бренда) — «Низкий уровень»
 *   null  — нейтральный (без бейджа возвращаем null)
 *
 * Размеры: sm (badge у имени), md (карточка), lg (личный кабинет).
 */
type Size = "sm" | "md" | "lg";

interface TrustBadgeProps {
  score: number | null | undefined;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}

const SIZE_MAP: Record<Size, { text: string; pad: string; icon: string; gap: string }> = {
  sm: { text: "text-[11px]", pad: "px-1.5 py-0.5", icon: "w-3 h-3", gap: "gap-1" },
  md: { text: "text-xs", pad: "px-2 py-1", icon: "w-3.5 h-3.5", gap: "gap-1.5" },
  lg: { text: "text-sm", pad: "px-3 py-1.5", icon: "w-4 h-4", gap: "gap-2" },
};

function getTier(score: number) {
  if (score >= 80) {
    return {
      label: "Высокий уровень доверия",
      short: "Высокий",
      // Брендовый бирюзовый #4A8587 как акцент.
      cls: "bg-[#E8F0F0] text-[#2F5C5E] border-[#A4C0C2]",
      Icon: ShieldCheck,
    };
  }
  if (score >= 50) {
    return {
      label: "Средний уровень доверия",
      short: "Средний",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
      Icon: Shield,
    };
  }
  return {
    label: "Низкий уровень доверия",
    short: "Низкий",
    // Брендовый акцент #C65D3B (терракот).
    cls: "bg-[#FBEDE7] text-[#8E3F23] border-[#E5B7A4]",
    Icon: ShieldAlert,
  };
}

export function TrustBadge({ score, size = "sm", showLabel = false, className = "" }: TrustBadgeProps) {
  if (score === null || score === undefined) return null;
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const tier = getTier(safe);
  const s = SIZE_MAP[size];
  const Icon = tier.Icon;

  return (
    <span
      title={`${tier.label} · ${safe}/100`}
      className={`inline-flex items-center ${s.gap} ${s.pad} rounded-full border font-bold ${s.text} ${tier.cls} transition-colors duration-200 ${className}`}
    >
      <Icon className={s.icon} />
      <span>
        {safe}
        {showLabel ? <span className="ml-1 font-medium opacity-90">· {tier.short}</span> : null}
      </span>
    </span>
  );
}

export default TrustBadge;
