import { useEffect, useState, useCallback } from "react";
import { X, Phone, Loader2, Check, AlertTriangle, Infinity as InfinityIcon, Gift } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface ContactBalance {
  balance: number;
  unlimitedUntil: string | null;
  unlimitedActive: boolean;
  bonusGranted: boolean;
  prices: { single: number; pack10: number; unlimited30d: number };
  contactLifetimeDays: number;
  history: Array<{
    id: number;
    kind: string;
    amountRub: number;
    contactsAdded: number;
    expiresAt: string | null;
    refundedAt: string | null;
    createdAt: string;
  }>;
}

interface UnlockResult {
  alreadyUnlocked: boolean;
  ownerPhone: string;
  ownerName: string | null;
  source: "balance" | "bonus" | "unlimited";
  priceCharged: number;
  expiresAt: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  listingId: number;
  listingTitle?: string;
  onUnlocked?: (phone: string) => void;
}

export function ContactPurchaseModal({ open, onClose, listingId, listingTitle, onUnlocked }: Props) {
  const [, navigate] = useLocation();
  const [balance, setBalance] = useState<ContactBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busyKind, setBusyKind] = useState<null | "single" | "pack10" | "unlimited30d" | "unlock">(null);
  const [unlock, setUnlock] = useState<UnlockResult | null>(null);

  const token = getToken();

  const fetchBalance = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/me/contact-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBalance(await res.json());
      else setError("Не удалось загрузить баланс");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open && token) {
      setUnlock(null);
      setError(null);
      setAgree(false);
      fetchBalance();
    }
  }, [open, token, fetchBalance]);

  if (!open) return null;

  // Не авторизован — мотивируем войти
  if (!token) {
    return (
      <ModalShell onClose={onClose} title="Связаться с владельцем">
        <p className="text-sm text-muted-foreground mb-4">
          Войдите, чтобы связаться с владельцем напрямую. Новым пользователям мы дарим
          бесплатные контакты при первом входе.
        </p>
        <button
          onClick={() => { onClose(); navigate("/auth"); }}
          className="btn-primary w-full py-3"
        >
          Войти или зарегистрироваться
        </button>
      </ModalShell>
    );
  }

  const topup = async (kind: "single" | "pack10" | "unlimited30d") => {
    setBusyKind(kind);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/me/contact-balance/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Не удалось пополнить");
      } else {
        await fetchBalance();
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyKind(null);
    }
  };

  const performUnlock = async () => {
    setBusyKind("unlock");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/listings/${listingId}/contact-purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          setError("Недостаточно контактов на балансе. Пополните ниже.");
        } else {
          setError(j.message ?? "Не удалось открыть контакт");
        }
      } else {
        setUnlock(j);
        await fetchBalance();
        onUnlocked?.(j.ownerPhone);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyKind(null);
    }
  };

  const hasContacts = (balance?.balance ?? 0) > 0 || balance?.unlimitedActive;
  const single = balance?.prices.single ?? 0;
  const pack10 = balance?.prices.pack10 ?? 0;
  const unlimited30d = balance?.prices.unlimited30d ?? 0;

  return (
    <ModalShell onClose={onClose} title="Связаться с владельцем">
      {listingTitle && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-1">«{listingTitle}»</p>
      )}

      {loading && !balance ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : unlock ? (
        // ─── Контакт открыт — показываем телефон ─────────────────────
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-2">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-1">
              {unlock.alreadyUnlocked ? "Контакт уже открыт ранее" : "Контакт открыт"}
            </p>
            {unlock.ownerName && <p className="text-sm text-green-900 font-medium">{unlock.ownerName}</p>}
            <a
              href={`tel:${unlock.ownerPhone}`}
              className="block mt-2 text-2xl font-display font-black text-green-800 hover:underline"
            >
              {unlock.ownerPhone}
            </a>
            {unlock.expiresAt && (
              <p className="text-[11px] text-green-700 mt-2">
                Доступен до {new Date(unlock.expiresAt).toLocaleDateString("ru")}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Позвоните владельцу и договоритесь о деталях. Безопасную сделку с защитой
            фонда обеспечивает только бронирование на платформе.
          </p>
          <button onClick={onClose} className="btn-secondary w-full py-3">Закрыть</button>
        </div>
      ) : (
        // ─── Покупка / списание ──────────────────────────────────────
        <div className="space-y-4">
          {/* Текущий баланс */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {balance?.unlimitedActive ? <InfinityIcon className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Ваш баланс</p>
              {balance?.unlimitedActive ? (
                <p className="text-sm font-bold">
                  Безлимит до {new Date(balance.unlimitedUntil!).toLocaleDateString("ru")}
                </p>
              ) : (
                <p className="text-base font-bold">
                  {balance?.balance ?? 0} {plural(balance?.balance ?? 0, "контакт", "контакта", "контактов")}
                  {balance?.bonusGranted && (balance?.balance ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      <Gift className="w-3 h-3" /> бонус
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {hasContacts ? (
            // Есть баланс — кнопка списания
            <>
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  Я понимаю, что списание {balance?.unlimitedActive ? "учитывается в безлимите" : "происходит сразу"}.
                  Платформа не гарантирует исполнение сделок вне Гарантийного фонда.
                </span>
              </label>
              <button
                onClick={performUnlock}
                disabled={!agree || busyKind === "unlock"}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busyKind === "unlock"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Открываем…</>
                  : <><Phone className="w-4 h-4" /> Открыть телефон владельца</>
                }
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                {balance?.unlimitedActive
                  ? "Безлимит активен — списания с баланса не будет"
                  : `Спишется 1 контакт. Останется: ${Math.max(0, (balance?.balance ?? 1) - 1)}`}
              </p>
            </>
          ) : (
            // Нет баланса — пополнение
            <>
              <p className="text-sm text-muted-foreground">Чтобы открыть телефон — пополните баланс контактов:</p>
              <div className="grid gap-2">
                <TopupButton
                  title="1 контакт"
                  subtitle="Разовая покупка"
                  price={single}
                  busy={busyKind === "single"}
                  onClick={() => topup("single")}
                />
                <TopupButton
                  title="Пакет 10 контактов"
                  subtitle={`${Math.round((pack10 / 10))} ₽ за контакт — выгоднее`}
                  price={pack10}
                  highlight
                  busy={busyKind === "pack10"}
                  onClick={() => topup("pack10")}
                />
                <TopupButton
                  title="Безлимит на 30 дней"
                  subtitle="Без ограничений"
                  price={unlimited30d}
                  busy={busyKind === "unlimited30d"}
                  onClick={() => topup("unlimited30d")}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Пополнение — мгновенное. Реальная оплата ЮKassa подключается отдельно.
              </p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function ModalShell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  // блокируем скролл body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white border-b border-border">
          <h3 className="font-display font-black text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function TopupButton({
  title, subtitle, price, busy, onClick, highlight,
}: { title: string; subtitle: string; price: number; busy: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
        highlight
          ? "border-primary bg-primary/5 hover:bg-primary/10"
          : "border-border bg-white hover:border-primary/40"
      }`}
    >
      <div className="min-w-0">
        <p className="font-bold text-sm">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
          : <p className="font-display font-black text-base text-primary">{price} ₽</p>
        }
      </div>
    </button>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m > 10 && m < 20) return many;
  if (m1 > 1 && m1 < 5) return few;
  if (m1 === 1) return one;
  return many;
}
