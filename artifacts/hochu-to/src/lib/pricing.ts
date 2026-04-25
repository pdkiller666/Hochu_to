/**
 * Stage 26 — Финансовая математика износа (амортизации) физических активов.
 *
 * Используется на стороне фронта для расчёта остаточной стоимости вещи в реальном
 * времени (карточка пула, будущий вторичный рынок долей).
 *
 * Серверного зеркала пока нет: расчёт нужен только в UI, бэк хранит «сырые»
 * счётчики (`listings.wear_and_tear_meter`) и админ-настройку
 * (`platform_settings.depreciation_per_rental_percent`). Если в Stage 27+ нам
 * потребуется применять остаточную стоимость в API (например, при
 * автоматической переоценке доли на бирже), вынесем функцию в общий
 * workspace-пакет и продублируем сюда.
 */

/** Минимум остаточной стоимости — 10% от исходной (нижний потолок амортизации). */
export const RESIDUAL_VALUE_FLOOR_RATIO = 0.1;

/**
 * Считает текущую остаточную стоимость вещи.
 *
 * Формула:
 *   residual = initialPrice × (1 − meter × depreciationPercent / 100)
 *   floor    = initialPrice × {@link RESIDUAL_VALUE_FLOOR_RATIO}
 *   result   = max(residual, floor)
 *
 * @param initialPrice    Исходная стоимость (что собрали в пул, ₽).
 * @param wearAndTearMeter Кол-во успешно завершённых аренд.
 * @param depreciationPercent % амортизации за одну аренду (из платформенных настроек).
 * @returns Текущая остаточная стоимость в рублях, не ниже 10% от исходной.
 *
 * @example
 *   calculateResidualValue(30000, 0, 1)   // → 30000 (новая)
 *   calculateResidualValue(30000, 50, 1)  // → 15000 (50% износа)
 *   calculateResidualValue(30000, 200, 1) // → 3000  (потолок 10%, не ниже)
 */
export function calculateResidualValue(
  initialPrice: number,
  wearAndTearMeter: number,
  depreciationPercent: number,
): number {
  if (!Number.isFinite(initialPrice) || initialPrice <= 0) return 0;
  const safeMeter = Math.max(0, Math.floor(wearAndTearMeter || 0));
  const safePercent = Math.max(0, depreciationPercent || 0);
  const ratio = 1 - (safeMeter * safePercent) / 100;
  const raw = initialPrice * ratio;
  const floor = initialPrice * RESIDUAL_VALUE_FLOOR_RATIO;
  return Math.round(Math.max(raw, floor) * 100) / 100;
}

/**
 * Считает % износа от исходной стоимости (для UI-бейджей).
 * Возвращает целое число от 0 до (100 - floor%).
 */
export function calculateDepreciationPercent(
  wearAndTearMeter: number,
  depreciationPercent: number,
): number {
  const safeMeter = Math.max(0, Math.floor(wearAndTearMeter || 0));
  const safePercent = Math.max(0, depreciationPercent || 0);
  const raw = safeMeter * safePercent;
  const ceiling = (1 - RESIDUAL_VALUE_FLOOR_RATIO) * 100;
  return Math.min(raw, ceiling);
}
