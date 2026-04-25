import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { listPools, type PoolListItem } from "@/lib/api-pools";
import { formatPrice } from "@/lib/utils";
import { Users, Target, ArrowRight, Plus, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

type StatusTab = "funding" | "purchasing" | "active";

const TAB_LABELS: Record<StatusTab, string> = {
  funding: "Идёт сбор",
  purchasing: "Идёт закупка",
  active: "Активные",
};

export default function Pools() {
  const [tab, setTab] = useState<StatusTab>("funding");
  const { data: pools, isLoading, error } = useQuery({
    queryKey: ["pools", tab],
    queryFn: () => listPools(tab),
  });

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-primary/5 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 text-primary text-sm font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Soft Launch — Beta
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-foreground leading-tight">
              Скиньтесь и купите<br />
              <span className="text-primary">вместе.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              Дорогая вещь нужна редко, а покупать в одиночку накладно. Создайте пул, найдите единомышленников и владейте долей. Деньги переводите напрямую инициатору по СБП — без эскроу-комиссий.
            </p>
            <Link
              href="/pools/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-5 h-5" /> Создать пул
            </Link>
          </div>
          <div className="flex-1 hidden md:block">
            <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center shadow-xl">
              <Users className="w-32 h-32 text-primary/40" strokeWidth={1.2} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex gap-2 border-b border-border mb-8 overflow-x-auto">
          {(["funding", "purchasing", "active"] as StatusTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="py-20 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="py-20 text-center text-red-600">
            Не удалось загрузить пулы. Попробуйте обновить страницу.
          </div>
        )}

        {pools && pools.length === 0 && (
          <div className="py-20 text-center">
            <Target className="w-12 h-12 mx-auto mb-3 text-primary/40" strokeWidth={1.5} />
            <h3 className="text-lg font-bold mb-1">Пока нет пулов в этом разделе</h3>
            <p className="text-muted-foreground text-sm">
              {tab === "funding"
                ? "Будьте первым — создайте пул на нужную вам вещь."
                : "Здесь появятся пулы, как только перейдут в этот статус."}
            </p>
          </div>
        )}

        {pools && pools.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {pools.map((p) => (
              <PoolCard key={p.id} pool={p} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function PoolCard({ pool }: { pool: PoolListItem }) {
  const pct = Math.min(100, Math.round((pool.collectedAmountRub / pool.targetAmountRub) * 100));
  return (
    <Link
      href={`/pools/${pool.id}`}
      className="group block bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {pool.title}
        </h3>
        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-md bg-accent/10 text-accent">
          СБП
        </span>
      </div>
      {pool.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{pool.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-baseline text-sm">
          <span className="font-bold text-primary">{formatPrice(pool.collectedAmountRub)}</span>
          <span className="text-muted-foreground text-xs">из {formatPrice(pool.targetAmountRub)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">{pct}% собрано</div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Target className="w-3.5 h-3.5" />
          <span className="text-xs">{pool.procurementStrategy === "self_managed" ? "Самозакуп" : "Консьерж"}</span>
        </div>
        <div className="flex items-center gap-1 text-primary font-bold group-hover:gap-2 transition-all">
          Подробнее <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}
