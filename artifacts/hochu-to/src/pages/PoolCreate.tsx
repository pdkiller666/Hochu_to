import { Layout } from "@/components/layout/Layout";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { createPool } from "@/lib/api-pools";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuthState } from "@/lib/auth";
import { usePublicSettings } from "@/lib/use-public-settings";
import { ArrowLeft, Loader2, Sparkles, ShieldCheck, CalendarClock } from "lucide-react";

export default function PoolCreate() {
  const [, setLocation] = useLocation();
  const { isAuthed, isReady } = useAuthState();
  const { settings } = usePublicSettings();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");

  useEffect(() => {
    if (isReady && !isAuthed) {
      setLocation("/auth?tab=login&redirect=/pools/create");
    }
  }, [isReady, isAuthed, setLocation]);

  const createMut = useMutation({
    mutationFn: createPool,
    onSuccess: (pool) => {
      toast({
        title: "Пул создан!",
        description: "Поделитесь ссылкой с теми, с кем хотите скинуться.",
      });
      setLocation(`/pools/${pool.id}`);
    },
    onError: (err: any) => {
      const message = err?.data?.message || err?.message || "Не удалось создать пул";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(targetAmount);
    if (!title.trim() || title.trim().length < 3) {
      toast({ title: "Название", description: "Минимум 3 символа", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Сумма", description: "Введите положительную сумму в рублях", variant: "destructive" });
      return;
    }
    if (!paymentDetails.trim()) {
      toast({ title: "Реквизиты", description: "Без реквизитов СБП дольщики не смогут перевести деньги", variant: "destructive" });
      return;
    }
    createMut.mutate({
      title: title.trim(),
      description: description.trim() || null,
      itemUrl: itemUrl.trim() || null,
      targetAmountRub: Math.round(amount),
      creatorPaymentDetails: paymentDetails.trim(),
      expiresAt: deadlineDate ? new Date(deadlineDate + "T23:59:59+03:00").toISOString() : null,
    });
  }

  const commercial = settings?.isCommercialMode === true;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/pools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Назад к пулам
        </Link>

        <div className="bg-white rounded-3xl border border-border shadow-sm p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-primary">Создание совместной покупки</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">Новый пул</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Опишите вещь, укажите сколько нужно собрать — и куда отправить деньги по СБП.
          </p>

          {!commercial && (
            <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-accent mb-1">Бета-режим: переводы напрямую</div>
                  <div className="text-foreground/80">
                    Дольщики переводят вам деньги по СБП, вы вручную подтверждаете каждое поступление. Эскроу подключим позже — пока без комиссии платформы.
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="Название" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: DJI Mini 4 Pro"
                maxLength={200}
                className="input w-full"
              />
            </Field>

            <Field label="Описание (необязательно)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Зачем покупаем, как будем пользоваться по очереди"
                maxLength={2000}
                rows={3}
                className="input w-full resize-none"
              />
            </Field>

            <Field label="Ссылка на товар (необязательно)">
              <input
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                placeholder="https://..."
                maxLength={2000}
                className="input w-full"
              />
            </Field>

            <Field label="Целевая сумма, ₽" required>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={100}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="100000"
                className="input w-full"
              />
            </Field>

            <Field
              label="Номер телефона / реквизиты СБП"
              required
              hint="Сюда дольщики будут переводить свои доли (Сбер, Т-Банк, ВТБ и т.д.)"
            >
              <input
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="+7 999 123-45-67 (Сбер)"
                maxLength={500}
                className="input w-full"
              />
            </Field>

            <Field
              label="Срок сбора (необязательно)"
              hint="Если сумма не наберётся к этой дате — пул автоматически отменится"
            >
              <div className="relative">
                <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={deadlineDate}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="input w-full pl-9"
                />
              </div>
              {deadlineDate && (
                <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⏳ Пул автоматически закроется <strong>{new Date(deadlineDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</strong>, если нужная сумма не соберётся.
                </div>
              )}
            </Field>

            <div className="pt-3 flex gap-3">
              <Link
                href="/pools"
                className="flex-1 py-3 text-center bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Создать пул
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-bold text-foreground mb-1.5">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </div>
      {children}
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </label>
  );
}
