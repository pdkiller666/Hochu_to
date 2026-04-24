import { useEffect, useState } from "react";
import { Crown, Zap, ArrowUp, X, Loader2, Check } from "lucide-react";

type Plan = { plan: string; days: number; priceRub: number };
type Pricing = { vip: Plan[]; urgent: Plan[]; boost: Plan[] };
type PromoType = "vip" | "urgent" | "boost";

const TYPE_META: Record<PromoType, {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badgeBg: string;
}> = {
  vip:    { title: "VIP-объявление",  desc: "Жёлтая рамка, корона, верх каталога.",         icon: Crown,   accent: "text-amber-700", badgeBg: "bg-amber-100 border-amber-300" },
  urgent: { title: "Срочно",          desc: "Красный бейдж и подъём в выдаче.",             icon: Zap,     accent: "text-red-700",   badgeBg: "bg-red-100 border-red-300" },
  boost:  { title: "Поднять в топ",   desc: "На 24 часа объявление встанет вверху списка.", icon: ArrowUp, accent: "text-orange-700",badgeBg: "bg-orange-100 border-orange-300" },
};

type Props = {
  listingId: number;
  listingTitle: string;
  token: string;
  apiBase?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function PromoteListingModal({ listingId, listingTitle, token, apiBase = "", onClose, onSuccess }: Props) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [type, setType] = useState<PromoType>("vip");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/promotions/pricing`)
      .then(r => r.json())
      .then((p: Pricing) => {
        setPricing(p);
        setSelectedPlan(p[type]?.[0]?.plan ?? "");
      })
      .catch(() => setError("Не удалось загрузить тарифы"));
  }, [apiBase]);

  useEffect(() => {
    if (pricing) setSelectedPlan(pricing[type]?.[0]?.plan ?? "");
  }, [type, pricing]);

  async function handlePay() {
    if (!selectedPlan) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${apiBase}/api/promotions/listings/${listingId}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, plan: selectedPlan }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Ошибка покупки");
      // Stage 21a: реальная ЮKassa возвращает paymentUrl — редиректим на форму оплаты.
      if (j?.mode === "redirect" && j?.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      setDone(j.validUntil);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const plans = pricing?.[type] ?? [];
  const selected = plans.find(p => p.plan === selectedPlan);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-bold text-lg">Продвижение</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-sm text-muted-foreground">
            Объявление: <span className="font-medium text-foreground">{listingTitle}</span>
          </div>

          {/* Tabs по типу */}
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_META) as PromoType[]).map(t => {
              const m = TYPE_META[t];
              const TIcon = m.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    active ? `${m.badgeBg} ${m.accent}` : "bg-white border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <TIcon className="w-5 h-5" />
                  {m.title.split(" ")[0]}
                </button>
              );
            })}
          </div>

          <div className={`rounded-xl border p-4 ${meta.badgeBg}`}>
            <div className={`flex items-center gap-2 font-bold ${meta.accent}`}>
              <Icon className="w-5 h-5" />
              {meta.title}
            </div>
            <p className="text-sm text-foreground/80 mt-1">{meta.desc}</p>
          </div>

          {/* Планы */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Выберите срок:</div>
            {plans.length === 0 ? (
              <div className="text-sm text-muted-foreground">Загружаем…</div>
            ) : (
              plans.map(p => (
                <label
                  key={p.plan}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPlan === p.plan ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="plan"
                      checked={selectedPlan === p.plan}
                      onChange={() => setSelectedPlan(p.plan)}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <div className="font-semibold">
                        {p.days >= 1 ? `${p.days} ${p.days === 1 ? "день" : p.days < 5 ? "дня" : "дней"}` : "24 часа"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ {p.days > 0 ? Math.round(p.priceRub / p.days) : p.priceRub}₽/день
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary text-lg">{p.priceRub}₽</div>
                  </div>
                </label>
              ))
            )}
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {done ? (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-start gap-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-bold">Продвижение активировано!</div>
                <div className="mt-0.5">Действует до {new Date(done).toLocaleString("ru-RU")}.</div>
              </div>
            </div>
          ) : (
            <button
              onClick={handlePay}
              disabled={loading || !selected}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Оплатить {selected ? `${selected.priceRub}₽` : ""}</>}
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            В бета-режиме продвижение активируется бесплатно. После запуска коммерческого режима средства будут списываться через ЮKassa.
          </p>
        </div>
      </div>
    </div>
  );
}
