import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Plus, Users2, TrendingUp, Crown, ChevronRight, PiggyBank, Clock, CheckCircle2, Layers } from "lucide-react";
import { getMyPools, type MyPoolItem, type PoolStatus } from "@/lib/api-pools";
import { formatPrice } from "@/lib/utils";

const STATUS_META: Record<PoolStatus, { label: string; className: string }> = {
  funding:    { label: "Идёт сбор",  className: "bg-blue-100 text-blue-700" },
  purchasing: { label: "Закупка",    className: "bg-amber-100 text-amber-700" },
  active:     { label: "Активен",    className: "bg-emerald-100 text-emerald-700" },
  liquidated: { label: "Завершён",   className: "bg-stone-100 text-stone-500" },
  canceled:   { label: "Отменён",    className: "bg-red-100 text-red-600" },
};

const SHARE_STATUS_META: Record<string, { label: string; className: string }> = {
  pending:           { label: "Перевод ожидается",          className: "text-stone-400" },
  user_transferred:  { label: "Перевёл, жду подтверждения", className: "text-amber-600" },
  creator_confirmed: { label: "Доля подтверждена",          className: "text-emerald-600" },
  escrow_held:       { label: "Доля подтверждена",          className: "text-emerald-600" },
};

function PoolCard({ pool }: { pool: MyPoolItem }) {
  const status = STATUS_META[pool.status];
  const progressPct = pool.targetAmountRub > 0
    ? Math.min(100, Math.round((pool.collectedAmountRub / pool.targetAmountRub) * 100))
    : 0;

  const myShareStatus = pool.myShare
    ? SHARE_STATUS_META[pool.myShare.paymentStatus] ?? { label: pool.myShare.paymentStatus, className: "text-stone-400" }
    : null;

  return (
    <Link href={`/pools/${pool.id}`}>
      <div className="group bg-white border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                {status.label}
              </span>
              {pool.isCreator && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Инициатор
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {pool.title}
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary shrink-0 mt-1 transition-colors" />
        </div>

        {/* Прогресс сбора */}
        {(pool.status === "funding" || pool.status === "purchasing") && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>{formatPrice(pool.collectedAmountRub)} собрано</span>
              <span>{progressPct}% из {formatPrice(pool.targetAmountRub)}</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Активный пул: доходы + фонд обслуживания */}
        {pool.status === "active" && (
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Фонд</span>
              </div>
              <div className="text-sm font-bold text-emerald-700">
                {formatPrice(pool.maintenanceFundBalance)}
              </div>
            </div>
            {pool.myShare && (
              <div className="flex-1 bg-stone-50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-stone-500 mb-0.5">
                  <PiggyBank className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Моя доля</span>
                </div>
                <div className="text-sm font-bold text-stone-700">
                  {parseFloat(pool.myShare.sharePercentage).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Моя доля (не активный) */}
        {pool.myShare && pool.status !== "active" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-400">Моя доля:</span>
            <span className="font-semibold text-stone-700">
              {parseFloat(pool.myShare.sharePercentage).toFixed(1)}% · {formatPrice(pool.myShare.amountRub)}
            </span>
            {myShareStatus && (
              <span className={`${myShareStatus.className} ml-auto`}>
                {myShareStatus.label}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function PoolsDashboardSection() {
  const { data: pools, isLoading, error } = useQuery<MyPoolItem[]>({
    queryKey: ["my-pools"],
    queryFn: getMyPools,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-10 justify-center text-stone-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Загрузка пулов…</span>
      </div>
    );
  }

  if (error || !pools) {
    return (
      <div className="text-center py-10 text-stone-400 text-sm">
        Не удалось загрузить пулы
      </div>
    );
  }

  const activePools = pools.filter(p => p.status !== "liquidated" && p.status !== "canceled");
  const closedPools = pools.filter(p => p.status === "liquidated" || p.status === "canceled");

  return (
    <div className="space-y-6">
      {/* Заголовок + кнопка создания */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Совместное владение
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Ваши пулы — созданные и с долевым участием
          </p>
        </div>
        <Link href="/pools/new">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Создать пул
          </button>
        </Link>
      </div>

      {pools.length === 0 && (
        <div className="text-center py-12 bg-white border border-dashed border-stone-200 rounded-2xl">
          <Users2 className="w-10 h-10 mx-auto text-stone-200 mb-3" />
          <p className="text-sm font-semibold text-stone-500 mb-1">У вас пока нет пулов</p>
          <p className="text-xs text-stone-400 mb-5">
            Скиньтесь с друзьями на дорогую вещь и пользуйтесь по очереди
          </p>
          <Link href="/pools">
            <button className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors">
              Смотреть все пулы
            </button>
          </Link>
        </div>
      )}

      {activePools.length > 0 && (
        <div className="space-y-3">
          {activePools.map(pool => <PoolCard key={pool.id} pool={pool} />)}
        </div>
      )}

      {closedPools.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-2 select-none py-1">
            <Clock className="w-3.5 h-3.5" />
            Завершённые и отменённые ({closedPools.length})
          </summary>
          <div className="mt-3 space-y-3 opacity-60">
            {closedPools.map(pool => <PoolCard key={pool.id} pool={pool} />)}
          </div>
        </details>
      )}

      {pools.length > 0 && (
        <div className="flex justify-center">
          <Link href="/pools">
            <button className="text-sm text-primary hover:underline flex items-center gap-1">
              Смотреть все публичные пулы →
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
