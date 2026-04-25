import { Layout } from "@/components/layout/Layout";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser } from "@workspace/api-client-react";
import {
  getPool,
  contributeShare,
  confirmShare,
  createShareOffer,
  buyShareOffer,
  confirmShareTransfer,
  cancelShareOffer,
  listPoolEvents,
  type PoolDetail,
  type PoolShareDetail,
  type ShareOfferDetail,
  type PoolEvent,
} from "@/lib/api-pools";
import { formatPrice } from "@/lib/utils";
import { calculateResidualValue, calculateDepreciationPercent } from "@/lib/pricing";
import { usePublicSettings } from "@/lib/use-public-settings";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DigitalActUpload } from "@/components/DigitalActUpload";
import {
  ArrowLeft,
  Loader2,
  Users,
  Target,
  ExternalLink,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Copy,
  Crown,
  Lock,
  Camera,
  Tag,
  ShoppingCart,
  X,
  TrendingDown,
  Handshake,
  Sparkles,
  Coins,
  ArrowRightLeft,
  History,
  Banknote,
} from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  funding: { label: "Идёт сбор", cls: "bg-accent/10 text-accent" },
  purchasing: { label: "Идёт закупка", cls: "bg-blue-100 text-blue-700" },
  active: { label: "Активен", cls: "bg-emerald-100 text-emerald-700" },
  liquidated: { label: "Распущен", cls: "bg-stone-200 text-stone-700" },
  canceled: { label: "Отменён", cls: "bg-red-100 text-red-700" },
};

const PAYMENT_LABEL: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Ожидание", cls: "bg-stone-100 text-stone-600", icon: Clock },
  user_transferred: { label: "Перевёл, ждёт подтверждения", cls: "bg-amber-100 text-amber-700", icon: Clock },
  creator_confirmed: { label: "Подтверждено", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  escrow_held: { label: "Эскроу", cls: "bg-blue-100 text-blue-700", icon: ShieldCheck },
};

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: pool, isLoading, error } = useQuery({
    queryKey: ["pool", id],
    queryFn: () => getPool(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const { data: me } = useGetCurrentUser();

  if (isLoading) {
    return (
      <Layout>
        <div className="py-20 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );
  }
  if (error || !pool) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-lg font-bold mb-2">Пул не найден</div>
          <Link href="/pools" className="text-primary hover:underline">
            ← К списку пулов
          </Link>
        </div>
      </Layout>
    );
  }

  const isCreator = me?.id === pool.creatorId;
  const pct = Math.min(100, Math.round((pool.collectedAmountRub / pool.targetAmountRub) * 100));
  const status = STATUS_LABEL[pool.status] ?? { label: pool.status, cls: "bg-stone-100 text-stone-600" };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/pools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> К списку пулов
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${status.cls}`}>{status.label}</span>
                {isCreator && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary inline-flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Вы — инициатор
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{pool.title}</h1>
              {pool.creator && (
                <div className="text-sm text-muted-foreground mt-1">
                  Инициатор: {pool.creator.firstName} {pool.creator.lastName ?? ""}
                </div>
              )}
            </div>
            {pool.itemUrl && (
              <a
                href={pool.itemUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                Ссылка на товар <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {pool.description && (
            <p className="text-foreground/80 text-sm mb-6 whitespace-pre-line">{pool.description}</p>
          )}

          {/* Progress */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-3xl font-extrabold text-primary">
                  {formatPrice(pool.collectedAmountRub)}
                </div>
                <div className="text-xs text-muted-foreground">собрано</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{formatPrice(pool.targetAmountRub)}</div>
                <div className="text-xs text-muted-foreground">цель</div>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pct}% собрано</span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" /> {pool.shares.length} участ.
              </span>
            </div>
          </div>

          {/* Action area */}
          {pool.status === "funding" && !isCreator && me && (
            <ContributeBlock pool={pool} myShare={pool.shares.find((s) => s.userId === me.id)} />
          )}

          {pool.status === "funding" && !me && (
            <Link
              href={`/auth?tab=login&redirect=/pools/${pool.id}`}
              className="block text-center w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Войдите, чтобы внести долю
            </Link>
          )}

          {pool.status !== "funding" && (
            <div className="p-4 rounded-xl bg-stone-100 text-sm text-stone-700 inline-flex items-center gap-2">
              <Lock className="w-4 h-4" /> Сбор средств закрыт.
            </div>
          )}
        </div>

        {/* Creator-only: pending transfers */}
        {isCreator && (
          <CreatorPendingBlock pool={pool} />
        )}

        {/* Stage 23c — Шаг 2 для creator при status='purchasing' */}
        {isCreator && pool.status === "purchasing" && (
          <ActivatePoolBlock pool={pool} />
        )}

        {/* Stage 26 — Оценочная стоимость (амортизация по факту аренд) */}
        {pool.status === "active" && pool.listing && (
          <ResidualValueBlock pool={pool} />
        )}

        {/* Stage 25 — Вторичный рынок долей */}
        <MarketplaceBlock pool={pool} meId={me?.id ?? null} />

        {/* All shares */}
        <SharesList pool={pool} meId={me?.id ?? null} />

        {/* Stage 27 — История событий пула */}
        <TimelineBlock poolId={pool.id} />
      </div>
    </Layout>
  );
}

function ContributeBlock({
  pool,
  myShare,
}: {
  pool: PoolDetail;
  myShare?: PoolShareDetail;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const mut = useMutation({
    mutationFn: (val: number) => contributeShare(pool.id, val),
    onSuccess: () => {
      toast({ title: "Готово", description: "Доля зарегистрирована, инициатор подтвердит поступление." });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      qc.invalidateQueries({ queryKey: ["pools"] });
      setOpen(false);
      setAmount("");
      setConfirmed(false);
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось зарегистрировать долю";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  if (myShare) {
    const p = PAYMENT_LABEL[myShare.paymentStatus];
    const Icon = p?.icon ?? Clock;
    return (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-1">
          <CheckCircle2 className="w-4 h-4" /> Ваша доля: {formatPrice(myShare.amountRub)} ({myShare.sharePercentage}%)
        </div>
        <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${p?.cls ?? "bg-stone-100"}`}>
          <Icon className="w-3 h-3" /> {p?.label ?? myShare.paymentStatus}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" /> Внести долю
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold mb-1">Внести долю</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Сколько вы готовы вложить? Это станет вашей долей в общей собственности.
            </p>

            <label className="block mb-4">
              <div className="text-sm font-bold mb-1.5">Сумма, ₽</div>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input w-full"
                placeholder="Например: 30000"
              />
            </label>

            {/* SBP instructions */}
            <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 mb-4">
              <div className="text-xs font-bold text-accent mb-2 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Реквизиты для перевода СБП
              </div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <code className="text-sm font-bold text-foreground break-all">
                  {pool.creatorPaymentDetails || "не указаны"}
                </code>
                {pool.creatorPaymentDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pool.creatorPaymentDetails!);
                      toast({ title: "Скопировано" });
                    }}
                    className="shrink-0 p-1.5 rounded-md hover:bg-accent/20 text-accent transition-colors"
                    title="Скопировать"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ol className="text-xs text-foreground/70 space-y-1 list-decimal list-inside">
                <li>Откройте приложение банка → СБП по номеру телефона</li>
                <li>Переведите указанную сумму инициатору</li>
                <li>В комментарии укажите название пула</li>
                <li>Вернитесь сюда и нажмите «Я перевёл»</li>
              </ol>
            </div>

            <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>Я подтверждаю, что отправил перевод по указанным реквизитам.</span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!confirmed || !amount || mut.isPending}
                onClick={() => {
                  const v = Number(amount);
                  if (!Number.isFinite(v) || v <= 0) {
                    toast({ title: "Сумма", description: "Введите положительное число", variant: "destructive" });
                    return;
                  }
                  mut.mutate(Math.round(v));
                }}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Я перевёл
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CreatorPendingBlock({ pool }: { pool: PoolDetail }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Defense-in-depth: исключаем доли creator-а (на бэке уже запрещено вносить
  // их через POST /shares, но если такая запись когда-либо появится — не даём
  // её самоподтвердить).
  const pending = pool.shares.filter(
    (s) => s.paymentStatus === "user_transferred" && s.userId !== pool.creatorId,
  );

  const mut = useMutation({
    mutationFn: (shareId: number) => confirmShare(pool.id, shareId),
    onSuccess: (data) => {
      toast({
        title: "Подтверждено",
        description: data.pool.status === "purchasing"
          ? "100% собрано — пул переходит в закупку!"
          : `Получено: ${formatPrice(data.collected)} из ${formatPrice(pool.targetAmountRub)}`,
      });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      qc.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось подтвердить";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  if (pool.status !== "funding") return null;

  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-extrabold">Ожидают подтверждения</h2>
        {pending.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
            {pending.length}
          </span>
        )}
      </div>
      {pending.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          Сейчас нет переводов на подтверждение. Когда дольщик нажмёт «Я перевёл», он появится здесь.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50"
            >
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{s.userName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPrice(s.amountRub)} ({s.sharePercentage}%) · {new Date(s.createdAt).toLocaleString("ru-RU")}
                </div>
              </div>
              <button
                onClick={() => mut.mutate(s.id)}
                disabled={mut.isPending}
                className="shrink-0 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {mut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Подтвердить получение
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SharesList({ pool, meId }: { pool: PoolDetail; meId: number | null }) {
  const [sellShare, setSellShare] = useState<PoolShareDetail | null>(null);

  if (pool.shares.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6 text-sm text-muted-foreground text-center">
        Пока нет долей. Будьте первым!
      </div>
    );
  }

  // Доля считается «продаваемой», если оплата подтверждена и нет открытого оффера.
  const openOfferShareIds = new Set(
    pool.offers.filter((o) => o.status === "open").map((o) => o.shareId),
  );
  const isSaleable = (s: PoolShareDetail) =>
    meId === s.userId &&
    (s.paymentStatus === "creator_confirmed" || s.paymentStatus === "escrow_held") &&
    !openOfferShareIds.has(s.id);

  return (
    <>
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8">
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Совладельцы
        </h2>
        <ul className="space-y-2">
          {pool.shares.map((s) => {
            const p = PAYMENT_LABEL[s.paymentStatus];
            const Icon = p?.icon ?? Clock;
            const mine = meId === s.userId;
            const hasOpenOffer = openOfferShareIds.has(s.id);
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  mine ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate inline-flex items-center gap-2">
                    {s.userName}
                    {mine && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                        Вы
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(s.amountRub)} · {s.sharePercentage}%
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${
                      p?.cls ?? "bg-stone-100"
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {p?.label ?? s.paymentStatus}
                  </span>
                  {isSaleable(s) && (
                    <button
                      onClick={() => setSellShare(s)}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
                      title="Выставить долю на продажу"
                    >
                      <Tag className="w-3 h-3" /> Продать
                    </button>
                  )}
                  {mine && hasOpenOffer && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">
                      <Tag className="w-3 h-3" /> На продаже
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {sellShare && (
        <SellShareModal
          pool={pool}
          share={sellShare}
          onClose={() => setSellShare(null)}
        />
      )}
    </>
  );
}


// ─── Stage 25: Вторичный рынок долей ──────────────────────────────────────

function MarketplaceBlock({ pool, meId }: { pool: PoolDetail; meId: number | null }) {
  const offers = pool.offers.filter((o) => o.status === "open");
  // Прячем блок только если нечего показать совсем (нет офферов И юзер не залогинен).
  // Если юзер вошёл, но офферов нет — покажем мини-объяснение.
  if (offers.length === 0 && !meId) return null;

  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <ShoppingCart className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-extrabold">Рынок долей</h2>
        {offers.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
            {offers.length}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        P2P-обмен между совладельцами. Деньги переводятся напрямую через СБП — платформа выступает реестром прав.
      </p>

      {offers.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Пока никто не выставил долю на продажу.
        </div>
      ) : (
        <ul className="space-y-3">
          {offers.map((o) => (
            <OfferRow key={o.id} pool={pool} offer={o} meId={meId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OfferRow({
  pool,
  offer,
  meId,
}: {
  pool: PoolDetail;
  offer: ShareOfferDetail;
  meId: number | null;
}) {
  const [buyOpen, setBuyOpen] = useState(false);
  const isSeller = meId === offer.sellerId;
  const isBuyer = meId !== null && meId === offer.buyerId;
  const reserved = offer.buyerId !== null;

  return (
    <li className="p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">
            {offer.sellerName}
            {isSeller && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                Вы продавец
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Доля {offer.sharePercentage}% · номинал {formatPrice(offer.amountRub)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-primary leading-none">
            {formatPrice(offer.priceRub)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">цена продавца</div>
        </div>
      </div>

      {reserved && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">
          <Clock className="w-3 h-3" /> Зарезервирован покупателем
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {!isSeller && meId && !reserved && (
          <button
            onClick={() => setBuyOpen(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Купить
          </button>
        )}
        {!isSeller && !meId && (
          <Link
            href={`/auth?tab=login&redirect=/pools/${pool.id}`}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Войдите, чтобы купить
          </Link>
        )}
        {isBuyer && (
          <span className="text-xs text-amber-700 font-bold inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Вы зарезервировали — переведите по СБП и ждите подтверждения продавца
          </span>
        )}
        {isSeller && <SellerOfferActions pool={pool} offer={offer} />}
      </div>

      {buyOpen && (
        <BuyOfferModal
          pool={pool}
          offer={offer}
          onClose={() => setBuyOpen(false)}
        />
      )}
    </li>
  );
}

function SellerOfferActions({ pool, offer }: { pool: PoolDetail; offer: ShareOfferDetail }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const reserved = offer.buyerId !== null;

  const confirmMut = useMutation({
    mutationFn: () => confirmShareTransfer(pool.id, offer.id),
    onSuccess: (data) => {
      toast({
        title: "Доля передана",
        description:
          data.mergeMode === "merge"
            ? "Покупатель уже был совладельцем — доли объединены."
            : "Право собственности переписано на покупателя.",
      });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось подтвердить передачу";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelShareOffer(pool.id, offer.id),
    onSuccess: () => {
      toast({ title: "Оффер отменён" });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось отменить";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  if (reserved) {
    return (
      <>
        <button
          onClick={() => confirmMut.mutate()}
          disabled={confirmMut.isPending}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          {confirmMut.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Handshake className="w-3.5 h-3.5" />
          )}
          Подтвердить получение и передать долю
        </button>
        <button
          onClick={() => {
            if (confirm("Отменить оффер? Резервация покупателя сбросится.")) cancelMut.mutate();
          }}
          disabled={cancelMut.isPending}
          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Отменить
        </button>
      </>
    );
  }

  return (
    <button
      onClick={() => {
        if (confirm("Снять долю с продажи?")) cancelMut.mutate();
      }}
      disabled={cancelMut.isPending}
      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
    >
      <X className="w-3.5 h-3.5" /> Снять с продажи
    </button>
  );
}

// ── Sell Modal — продавец выставляет долю ─────────────────────────────────
function SellShareModal({
  pool,
  share,
  onClose,
}: {
  pool: PoolDetail;
  share: PoolShareDetail;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const settings = usePublicSettings();

  // Stage 26: справедливая цена = остаточная стоимость пула × % доли.
  // Если listing нет (пул ещё без вещи) — используем номинал.
  const meter = pool.listing?.wearAndTearMeter ?? 0;
  const depPercent = settings?.depreciationPerRentalPercent ?? 1;
  const residualPool = pool.listing
    ? calculateResidualValue(pool.targetAmountRub, meter, depPercent)
    : pool.targetAmountRub;
  const sharePct = Number(share.sharePercentage);
  const fairPrice = Math.max(0, Math.round((residualPool * sharePct) / 100));
  const wearPct = pool.listing
    ? calculateDepreciationPercent(meter, depPercent)
    : 0;

  const [price, setPrice] = useState(String(fairPrice));
  const [paymentDetails, setPaymentDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      createShareOffer(pool.id, share.id, {
        priceRub: Math.round(Number(price)),
        sellerPaymentDetails: paymentDetails.trim(),
      }),
    onSuccess: () => {
      toast({
        title: "Оффер создан",
        description: "Доля выставлена на вторичный рынок. Покупатели увидят её в блоке «Рынок долей».",
      });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось создать оффер";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  const priceNum = Number(price);
  const priceValid = Number.isFinite(priceNum) && priceNum >= 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-xl font-extrabold">Продать долю</h2>
          <button
            onClick={onClose}
            className="p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Ваша доля {share.sharePercentage}% (номинал {formatPrice(share.amountRub)}). После создания оффера
          покупатель сможет зарезервировать его и перевести вам деньги через СБП.
        </p>

        {/* Fair-price hint */}
        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-stone-50 border border-violet-200 p-4 mb-4">
          <div className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-violet-800 mb-1">Справедливая цена</div>
              <div className="text-2xl font-extrabold text-stone-900 leading-none">
                {formatPrice(fairPrice)}
              </div>
              <div className="text-[11px] text-stone-600 mt-1.5 leading-snug">
                {pool.listing
                  ? `Оценочная стоимость пула ${formatPrice(residualPool)} × ${share.sharePercentage}%${
                      meter > 0 ? ` (износ ${wearPct.toFixed(1)}% после ${meter} аренд)` : ""
                    }. Можно указать любую цену.`
                  : `Пул ещё не активирован — расчёт по номиналу. Можно указать любую цену.`}
              </div>
            </div>
          </div>
        </div>

        <label className="block mb-4">
          <div className="text-sm font-bold mb-1.5">Цена продажи, ₽</div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input w-full"
          />
          <button
            type="button"
            onClick={() => setPrice(String(fairPrice))}
            className="text-xs text-primary hover:underline mt-1"
          >
            Сбросить к справедливой
          </button>
        </label>

        <label className="block mb-4">
          <div className="text-sm font-bold mb-1.5">Ваши реквизиты для перевода (СБП)</div>
          <input
            type="text"
            value={paymentDetails}
            onChange={(e) => setPaymentDetails(e.target.value)}
            className="input w-full"
            placeholder="+7 999 123-45-67 (Тинькофф)"
            maxLength={500}
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Покупатель увидит эти данные после нажатия «Купить».
          </div>
        </label>

        <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Я понимаю: после получения денег я обязан подтвердить передачу — доля автоматически перейдёт
            покупателю.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={
              !priceValid || !paymentDetails.trim() || !confirmed || mut.isPending
            }
            onClick={() => mut.mutate()}
            className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {mut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Tag className="w-4 h-4" />
            )}
            Выставить на продажу
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buy Modal — покупатель резервирует и видит реквизиты ──────────────────
function BuyOfferModal({
  pool,
  offer,
  onClose,
}: {
  pool: PoolDetail;
  offer: ShareOfferDetail;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reserved, setReserved] = useState<{
    sellerPaymentDetails: string | null;
    instructions: string;
  } | null>(null);

  const mut = useMutation({
    mutationFn: () => buyShareOffer(pool.id, offer.id),
    onSuccess: (data) => {
      setReserved({
        sellerPaymentDetails: data.sellerPaymentDetails,
        instructions: data.instructions,
      });
      qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
    },
    onError: (err: any) => {
      const msg = err?.data?.message || err?.message || "Не удалось зарезервировать";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-xl font-extrabold">Купить долю</h2>
          <button
            onClick={onClose}
            className="p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Доля {offer.sharePercentage}% от пула «{pool.title}», продавец — {offer.sellerName}.
        </p>

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
          <div className="text-xs font-bold text-primary mb-1">Сумма перевода</div>
          <div className="text-3xl font-extrabold text-foreground leading-none">
            {formatPrice(offer.priceRub)}
          </div>
        </div>

        {!reserved ? (
          <>
            <div className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Нажмите «Зарезервировать», чтобы заблокировать оффер за вами. После этого
              получите реквизиты СБП и переведёте деньги напрямую продавцу. Когда продавец
              подтвердит получение — доля автоматически перейдёт к вам.
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {mut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
                Зарезервировать
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Оффер зарезервирован за вами
              </div>
              <div className="text-xs font-bold text-emerald-900 mb-2 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Реквизиты продавца (СБП)
              </div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <code className="text-sm font-bold text-foreground break-all">
                  {reserved.sellerPaymentDetails || "не указаны"}
                </code>
                {reserved.sellerPaymentDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(reserved.sellerPaymentDetails!);
                      toast({ title: "Скопировано" });
                    }}
                    className="shrink-0 p-1.5 rounded-md hover:bg-emerald-100 text-emerald-700 transition-colors"
                    title="Скопировать"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-emerald-900/70 leading-snug">{reserved.instructions}</div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Понятно
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// Stage 23c — Шаг 2: creator подтверждает покупку Genesis-актом.
// После активации бэк создаёт listing-черновик и переводит pool → 'active'.
function ActivatePoolBlock({ pool }: { pool: PoolDetail }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold">
          2
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base">Подтвердите покупку и создайте объявление</h3>
          <p className="text-sm text-blue-900/80 mt-1">
            Сбор завершён. Купите вещь, сфотографируйте её (4+ ракурса) и подпишите Genesis-акт —
            мы автоматически создадим объявление-черновик в вашем кабинете.
          </p>
        </div>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
      >
        <Camera className="w-4 h-4" />
        Загрузить фото и активировать
      </button>

      {open && (
        <DigitalActUpload
          poolId={pool.id}
          type="check_in"
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            toast({
              title: "Готово!",
              description: "Объявление-черновик создано. Отредактируйте категорию, регион и цену в Кабинете.",
            });
            qc.invalidateQueries({ queryKey: ["pool", pool.id] });
      qc.invalidateQueries({ queryKey: ["pool-events", pool.id] });
            qc.invalidateQueries({ queryKey: ["pools"] });
            qc.invalidateQueries({ queryKey: ["my-listings"] });
            // Подтолкнём пользователя сразу в Кабинет — там лежит свежий черновик.
            setTimeout(() => navigate("/cabinet/listings"), 800);
          }}
        />
      )}
    </div>
  );
}

// ─── Stage 26: Оценочная стоимость + счётчик износа ───────────────────────
function ResidualValueBlock({ pool }: { pool: PoolDetail }) {
  const settings = usePublicSettings();
  if (!pool.listing) return null;

  const initialPrice = pool.targetAmountRub;
  const meter = pool.listing.wearAndTearMeter;
  const depreciationPercent = settings?.depreciationPerRentalPercent ?? 1;
  const residual = calculateResidualValue(initialPrice, meter, depreciationPercent);
  const wearPercent = calculateDepreciationPercent(meter, depreciationPercent);

  return (
    <div className="bg-gradient-to-br from-violet-50 to-stone-50 border border-violet-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
          <Crown className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-stone-700">Оценочная стоимость сейчас</h3>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600"
              title={`Каждая успешно завершённая аренда снижает оценку на ${depreciationPercent}%. Минимум — 10% от исходной стоимости.`}
            >
              {meter} {meter === 1 ? "аренда" : meter >= 2 && meter <= 4 ? "аренды" : "аренд"} · износ {wearPercent.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-stone-900">{formatPrice(residual)}</div>
          <p className="mt-1 text-xs text-stone-500">
            Исходная стоимость: {formatPrice(initialPrice)} · амортизация {depreciationPercent}% за каждую аренду
          </p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Stage 27 — История событий пула (TimelineBlock)
// ───────────────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, { icon: any; cls: string }> = {
  pool_created:       { icon: Sparkles,       cls: "bg-amber-100 text-amber-700" },
  share_contributed:  { icon: Banknote,       cls: "bg-stone-100 text-stone-700" },
  share_confirmed:    { icon: CheckCircle2,   cls: "bg-emerald-100 text-emerald-700" },
  pool_purchasing:    { icon: ShoppingCart,   cls: "bg-blue-100 text-blue-700" },
  offer_created:      { icon: Tag,            cls: "bg-violet-100 text-violet-700" },
  offer_reserved:     { icon: Handshake,      cls: "bg-indigo-100 text-indigo-700" },
  share_transferred:  { icon: ArrowRightLeft, cls: "bg-emerald-100 text-emerald-700" },
  offer_canceled:     { icon: X,              cls: "bg-stone-200 text-stone-600" },
};

function describeEvent(ev: PoolEvent): string {
  const m = ev.metadata ?? {};
  const actor = ev.actorName ?? "Система";
  switch (ev.eventType) {
    case "pool_created":
      return `${actor} создал пул${m.targetAmountRub ? ` на ${formatPrice(Number(m.targetAmountRub))}` : ""}`;
    case "share_contributed": {
      const amount = m.amountRub ? formatPrice(Number(m.amountRub)) : "сумму";
      const pct = m.sharePercentage ? ` (${m.sharePercentage}%)` : "";
      return `${actor} перевёл ${amount}${pct} — ждёт подтверждения`;
    }
    case "share_confirmed": {
      const amount = m.amountRub ? formatPrice(Number(m.amountRub)) : "";
      return `${actor} подтвердил получение ${amount} от участника`.trim();
    }
    case "pool_purchasing":
      return `Сбор завершён — пул перешёл в стадию закупки`;
    case "offer_created": {
      const price = m.priceRub != null ? formatPrice(Number(m.priceRub)) : "";
      const pct = m.sharePercentage ? ` (${m.sharePercentage}%)` : "";
      return `${actor} выставил долю${pct} на продажу за ${price}`.trim();
    }
    case "offer_reserved": {
      const price = m.priceRub != null ? formatPrice(Number(m.priceRub)) : "";
      return `${actor} зарезервировал оффер за ${price} — ждёт перевод`.trim();
    }
    case "share_transferred": {
      const price = m.priceRub != null ? formatPrice(Number(m.priceRub)) : "";
      const mode = m.mergeMode === "merge" ? "доли объединены" : "доля передана";
      return `${actor} подтвердил получение ${price} — ${mode}`.trim();
    }
    case "offer_canceled":
      return `${actor} отменил продажу доли`;
    default:
      return `${actor}: ${ev.eventType}`;
  }
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  return `${time} · ${date}`;
}

function TimelineBlock({ poolId }: { poolId: number }) {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ["pool-events", poolId],
    queryFn: () => listPoolEvents(poolId),
    refetchInterval: 30_000,
  });

  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8 mt-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center">
          <History className="w-4 h-4 text-stone-600" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold leading-tight">История событий</h2>
          <p className="text-xs text-muted-foreground">Прозрачная хронология всех операций пула</p>
        </div>
      </div>

      {isLoading && (
        <div className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="py-6 text-sm text-muted-foreground text-center">
          Не удалось загрузить историю событий
        </div>
      )}

      {!isLoading && !error && events && events.length === 0 && (
        <div className="py-8 text-center">
          <div className="text-sm font-medium text-stone-700 mb-1">Здесь появятся события пула</div>
          <p className="text-xs text-muted-foreground">
            Взносы, подтверждения, продажи долей — всё будет видно всем участникам
          </p>
        </div>
      )}

      {!isLoading && !error && events && events.length > 0 && (
        <ol className="relative space-y-3 sm:space-y-4">
          {events.map((ev) => {
            const meta = EVENT_ICON[ev.eventType] ?? { icon: Clock, cls: "bg-stone-100 text-stone-600" };
            const Icon = meta.icon;
            return (
              <li key={ev.id} className="flex gap-3 items-start group">
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${meta.cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="text-sm text-foreground/90 leading-snug">
                    {describeEvent(ev)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatEventTime(ev.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
