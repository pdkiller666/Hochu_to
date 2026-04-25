import { Layout } from "@/components/layout/Layout";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser } from "@workspace/api-client-react";
import {
  getPool,
  contributeShare,
  confirmShare,
  type PoolDetail,
  type PoolShareDetail,
} from "@/lib/api-pools";
import { formatPrice } from "@/lib/utils";
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

        {/* All shares */}
        <SharesList pool={pool} />
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

function SharesList({ pool }: { pool: PoolDetail }) {
  if (pool.shares.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-border shadow-sm p-6 text-sm text-muted-foreground text-center">
        Пока нет долей. Будьте первым!
      </div>
    );
  }
  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8">
      <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> Совладельцы
      </h2>
      <ul className="space-y-2">
        {pool.shares.map((s) => {
          const p = PAYMENT_LABEL[s.paymentStatus];
          const Icon = p?.icon ?? Clock;
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:border-primary/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{s.userName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPrice(s.amountRub)} · {s.sharePercentage}%
                </div>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${p?.cls ?? "bg-stone-100"}`}>
                <Icon className="w-3 h-3" /> {p?.label ?? s.paymentStatus}
              </span>
            </li>
          );
        })}
      </ul>
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
