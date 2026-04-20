import { Layout } from "@/components/layout/Layout";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, Package, CalendarDays, LifeBuoy,
  Search, Ban, CheckCircle, ChevronLeft, ChevronRight,
  ShieldAlert, TrendingUp, Clock, Ticket, Eye, EyeOff,
  MessageSquare, AlertTriangle, ScrollText, Bell, Send,
  X, Pencil, ExternalLink, Trash2, RefreshCw, UserCheck,
  BarChart2, ArrowUpDown, Flag, Shield, Megaphone,
  Coins, CreditCard, Save, RotateCcw,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const API = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  bookings: { totalBookings: number; pending: number; active: number; completed: number; return_pending: number; cancelled: number };
  users: { totalUsers: number; banned: number; admins: number; owners: number; newThisWeek: number };
  listings: { totalListings: number; active: number; hidden: number; newThisWeek: number };
  tickets: { totalTickets: number; open: number; in_progress: number; resolved: number };
  reports: { total: number; pending: number; resolved: number };
  revenue: { total: number; completed: number };
}
interface AdminUser {
  id: number; name: string; email: string; role: string; phone?: string; avatar?: string;
  bio?: string; telegram?: string; isBanned: boolean; banReason?: string;
  createdAt: string; regionId?: number;
  listingCount: number; bookingCount: number; reviewCount: number; avgRating?: number;
}
interface AdminListing {
  id: number; title: string; photos: string[]; pricePerDay: number;
  isActive: boolean; createdAt: string; ownerId: number; ownerName: string; ownerEmail: string;
  bookingCount: number; activeBookings: number; city?: string;
}
interface AdminBooking {
  id: number; bookingNumber: string; listingTitle: string; listingId: number;
  renterId: number; renterName: string; renterEmail: string;
  ownerId: number; ownerName: string; ownerEmail: string;
  totalPrice: number; status: string; startDate: string; endDate: string; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", confirmed: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700", return_pending: "bg-orange-100 text-orange-700",
  completed: "bg-stone-100 text-stone-600", rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700", open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700", resolved: "bg-green-100 text-green-700",
  closed: "bg-stone-100 text-stone-500", pending_report: "bg-orange-100 text-orange-700",
  dismissed: "bg-stone-100 text-stone-500",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидает", confirmed: "Подтверждено", active: "Активно",
  return_pending: "Возврат", completed: "Завершено", rejected: "Отклонено", cancelled: "Отменено",
  open: "Открыт", in_progress: "В работе", resolved: "Решён", closed: "Закрыт",
  dismissed: "Отклонено",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "text-stone-400", normal: "text-blue-600", high: "text-orange-600", urgent: "text-red-600",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "⚪ Низкий", normal: "🔵 Обычный", high: "🟠 Высокий", urgent: "🔴 Срочный",
};
const CATEGORY_LABEL: Record<string, string> = {
  general: "Общий", dispute: "Спор", technical: "Техническая", billing: "Оплата",
};
const REPORT_REASON_LABEL: Record<string, string> = {
  spam: "Спам", fraud: "Мошенничество", inappropriate: "Неприемлемый контент",
  fake: "Поддельное объявление", other: "Другое",
};
const PIE_COLORS = ["#C65D3B","#2563eb","#16a34a","#ca8a04","#dc2626","#6b7280"];

function Badge({ cls, label }: { cls: string; label: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── Generic data hook ────────────────────────────────────────────────────────
function useFetch<T>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetch(url, { headers: getAuthHeaders() })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [url, rev, ...deps]);
  return { data, loading, refresh: () => setRev(r => r + 1) };
}

// ─── SlideOver ────────────────────────────────────────────────────────────────
function SlideOver({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white h-full shadow-2xl overflow-y-auto flex flex-col ${wide ? "w-full max-w-3xl" : "w-full max-w-xl"}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-stone-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="font-semibold text-stone-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, alert }: {
  icon: any; label: string; value: number | string; sub?: string; color: string; alert?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 flex items-center gap-4 ${alert ? "border-red-200 bg-red-50/50" : "border-stone-200"}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-stone-800 truncate">{value}</div>
        <div className="text-sm text-stone-500">{label}</div>
        {sub && <div className="text-xs text-stone-400">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="p-1 rounded hover:bg-stone-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
      <span className="text-sm text-stone-600">{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages}
        className="p-1 rounded hover:bg-stone-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

// ─── BroadcastModal ───────────────────────────────────────────────────────────
function BroadcastModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    const r = await fetch(`${API}/api/admin/broadcast`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, link: link || null, roles: roles.length ? roles : undefined }),
    });
    setSending(false);
    if (r.ok) {
      const d = await r.json();
      toast({ title: `Уведомление отправлено`, description: `${d.sent} получателей` });
      onClose(); setTitle(""); setBody(""); setLink(""); setRoles([]);
    }
  }

  const toggleRole = (r: string) => setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  return (
    <Modal open={open} onClose={onClose} title="Массовая рассылка уведомлений">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-stone-700 block mb-1">Получатели</label>
          <div className="flex gap-2">
            {["renter","owner","admin"].map(r => (
              <button key={r} onClick={() => toggleRole(r)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition ${roles.includes(r) ? "bg-[#C65D3B] text-white border-[#C65D3B]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                {r === "renter" ? "Арендаторы" : r === "owner" ? "Владельцы" : "Администраторы"}
              </button>
            ))}
            {roles.length > 0 && <button onClick={() => setRoles([])} className="text-xs text-stone-400 hover:text-stone-600">Все</button>}
          </div>
          <p className="text-xs text-stone-400 mt-1">{roles.length === 0 ? "Всем пользователям" : `Роли: ${roles.join(", ")}`}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700 block mb-1">Заголовок *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Важное сообщение"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700 block mb-1">Текст *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder="Текст уведомления…"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700 block mb-1">Ссылка (необязательно)</label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="/catalog"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Отмена</button>
          <button onClick={send} disabled={sending || !title.trim() || !body.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] disabled:opacity-50 transition">
            <Megaphone className="w-4 h-4" /> {sending ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── UserDetailPanel ──────────────────────────────────────────────────────────
function UserDetailPanel({ userId, onClose, onChanged }: {
  userId: number | null; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const { data, loading, refresh } = useFetch<any>(userId ? `${API}/api/admin/users/${userId}` : null, [userId]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", bio: "", telegram: "", role: "" });
  const [notifyForm, setNotifyForm] = useState({ title: "", body: "", link: "" });
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    if (data?.user) {
      setForm({
        name: data.user.name ?? "", email: data.user.email ?? "",
        phone: data.user.phone ?? "", bio: data.user.bio ?? "",
        telegram: data.user.telegram ?? "", role: data.user.role ?? "renter",
      });
    }
  }, [data?.user?.id]);

  async function saveEdit() {
    if (!userId) return;
    setSaving(true);
    const r = await fetch(`${API}/api/admin/users/${userId}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { toast({ title: "Сохранено" }); setEditing(false); refresh(); onChanged(); }
  }

  async function sendNotify() {
    if (!userId || !notifyForm.title.trim() || !notifyForm.body.trim()) return;
    const r = await fetch(`${API}/api/admin/users/${userId}/notify`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(notifyForm),
    });
    if (r.ok) { toast({ title: "Уведомление отправлено" }); setNotifyOpen(false); setNotifyForm({ title: "", body: "", link: "" }); }
  }

  async function toggleBan() {
    if (!data?.user || !userId) return;
    const isBanned = !data.user.isBanned;
    const r = await fetch(`${API}/api/admin/users/${userId}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ isBanned, banReason: isBanned ? banReason : null }),
    });
    if (r.ok) {
      toast({ title: isBanned ? "Пользователь заблокирован" : "Блокировка снята" });
      setBanOpen(false); setBanReason(""); refresh(); onChanged();
    }
  }

  const u = data?.user;
  return (
    <SlideOver open={!!userId} onClose={onClose} title={u ? `Пользователь: ${u.name}` : "Загрузка…"} wide>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : u && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(!editing)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${editing ? "bg-[#C65D3B] text-white border-[#C65D3B]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
              <Pencil className="w-3.5 h-3.5" /> Редактировать
            </button>
            <button onClick={() => setNotifyOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
              <Bell className="w-3.5 h-3.5" /> Уведомить
            </button>
            <a href={`/users/${u.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
              <ExternalLink className="w-3.5 h-3.5" /> Профиль
            </a>
            <button onClick={() => u.isBanned ? toggleBan() : setBanOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border font-medium transition ml-auto ${u.isBanned ? "border-green-300 text-green-700 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
              {u.isBanned ? <><CheckCircle className="w-3.5 h-3.5" /> Разблокировать</> : <><Ban className="w-3.5 h-3.5" /> Заблокировать</>}
            </button>
          </div>

          {u.isBanned && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
              <Ban className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div><strong>Заблокирован</strong>{u.banReason ? `: ${u.banReason}` : ""}</div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: "Объявлений", v: Number(data.stats?.listing_count ?? 0) },
              { l: "Бронирований", v: Number(data.stats?.booking_count ?? 0) },
              { l: "Отзывов", v: Number(data.stats?.review_count ?? 0) },
              { l: "Рейтинг", v: data.stats?.avg_rating ? `★ ${data.stats.avg_rating}` : "—" },
            ].map(s => (
              <div key={s.l} className="bg-stone-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-stone-800">{s.v}</div>
                <div className="text-xs text-stone-500">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2"><Pencil className="w-4 h-4" /> Редактирование</h4>
              {[
                { label: "Имя", key: "name" }, { label: "Email", key: "email" },
                { label: "Телефон", key: "phone" }, { label: "Telegram", key: "telegram" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-stone-600 font-medium block mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
                </div>
              ))}
              <div>
                <label className="text-xs text-stone-600 font-medium block mb-1">О себе</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3}
                  className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
              </div>
              <div>
                <label className="text-xs text-stone-600 font-medium block mb-1">Роль</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                  <option value="renter">Арендатор</option>
                  <option value="owner">Владелец</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200">Отмена</button>
                <button onClick={saveEdit} disabled={saving}
                  className="px-4 py-1.5 text-sm bg-[#C65D3B] text-white rounded-lg hover:bg-[#b54f2f] disabled:opacity-50">
                  {saving ? "…" : "Сохранить"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { l: "Email", v: u.email }, { l: "Роль", v: u.role },
                { l: "Телефон", v: u.phone || "—" }, { l: "Telegram", v: u.telegram || "—" },
                { l: "Регистрация", v: format(new Date(u.createdAt), "dd.MM.yyyy") },
              ].map(i => (
                <div key={i.l}>
                  <div className="text-stone-400 text-xs">{i.l}</div>
                  <div className="text-stone-700 font-medium truncate">{i.v}</div>
                </div>
              ))}
              {u.bio && (
                <div className="col-span-2">
                  <div className="text-stone-400 text-xs">О себе</div>
                  <div className="text-stone-700">{u.bio}</div>
                </div>
              )}
            </div>
          )}

          {/* Notify modal inline */}
          {notifyOpen && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-blue-600" /> Отправить уведомление</h4>
              <input value={notifyForm.title} onChange={e => setNotifyForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Заголовок *" className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <textarea value={notifyForm.body} onChange={e => setNotifyForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Текст *" rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input value={notifyForm.link} onChange={e => setNotifyForm(p => ({ ...p, link: e.target.value }))}
                placeholder="Ссылка (необязательно)" className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <button onClick={() => setNotifyOpen(false)} className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200">Отмена</button>
                <button onClick={sendNotify} disabled={!notifyForm.title || !notifyForm.body}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> Отправить
                </button>
              </div>
            </div>
          )}

          {/* Ban confirm */}
          {banOpen && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-red-700 text-sm flex items-center gap-2"><Ban className="w-4 h-4" /> Заблокировать пользователя</h4>
              <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={2}
                placeholder="Причина блокировки (необязательно)…"
                className="w-full border border-red-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
              <div className="flex gap-2">
                <button onClick={() => setBanOpen(false)} className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200">Отмена</button>
                <button onClick={toggleBan} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Заблокировать</button>
              </div>
            </div>
          )}

          {/* Listings */}
          {data?.listings?.length > 0 && (
            <div>
              <h4 className="font-semibold text-stone-700 mb-2 flex items-center gap-2 text-sm"><Package className="w-4 h-4" /> Объявления ({data.listings.length})</h4>
              <div className="space-y-2">
                {data?.listings?.slice(0, 5).map((l: any) => (
                  <a key={l.id} href={`/listings/${l.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-stone-50 rounded-xl hover:bg-stone-100 transition">
                    <div className="text-sm font-medium text-stone-700 truncate flex-1">{l.title}</div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 flex-shrink-0 ml-2">
                      <span>{l.booking_count} аренд</span>
                      {!l.is_available && <Badge cls="bg-red-100 text-red-600" label="скрыто" />}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Recent bookings */}
          {data?.bookings?.length > 0 && (
            <div>
              <h4 className="font-semibold text-stone-700 mb-2 flex items-center gap-2 text-sm"><CalendarDays className="w-4 h-4" /> Бронирования ({data.bookings.length})</h4>
              <div className="space-y-2">
                {data?.bookings?.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                    <div className="text-xs font-mono text-stone-400">{b.booking_number}</div>
                    <div className="text-sm text-stone-700 truncate flex-1 mx-3">{b.listing_title}</div>
                    <Badge cls={STATUS_COLORS[b.status] ?? "bg-stone-100 text-stone-600"} label={STATUS_LABEL[b.status] ?? b.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}

// ─── ListingDetailPanel ───────────────────────────────────────────────────────
function ListingDetailPanel({ listingId, onClose, onChanged }: {
  listingId: number | null; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const { data, loading, refresh } = useFetch<any>(listingId ? `${API}/api/admin/listings/${listingId}` : null, [listingId]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", pricePerDay: "", deposit: "", city: "", meetingAddress: "", isActive: true });
  const [delConfirm, setDelConfirm] = useState(false);

  useEffect(() => {
    if (data?.listing) {
      const l = data.listing;
      setForm({
        title: l.title ?? "", description: l.description ?? "",
        pricePerDay: String(parseFloat(l.price_per_day) || 0),
        deposit: l.deposit ? String(parseFloat(l.deposit)) : "",
        city: l.city ?? "", meetingAddress: l.meeting_address ?? "",
        isActive: l.is_available ?? true,
      });
    }
  }, [data?.listing?.id]);

  async function saveEdit() {
    if (!listingId) return;
    setSaving(true);
    const r = await fetch(`${API}/api/admin/listings/${listingId}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, pricePerDay: parseFloat(form.pricePerDay), deposit: form.deposit ? parseFloat(form.deposit) : null }),
    });
    setSaving(false);
    if (r.ok) { toast({ title: "Объявление обновлено" }); setEditing(false); refresh(); onChanged(); }
  }

  async function deleteListing() {
    if (!listingId) return;
    const r = await fetch(`${API}/api/admin/listings/${listingId}`, {
      method: "DELETE", headers: getAuthHeaders(),
    });
    if (r.ok) { toast({ title: "Объявление удалено" }); onClose(); onChanged(); }
  }

  const l = data?.listing;
  return (
    <SlideOver open={!!listingId} onClose={onClose} title={l ? l.title : "Загрузка…"} wide>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : l && (
        <div className="space-y-5">
          {/* Photo */}
          {l.photos?.[0] && (
            <img src={l.photos[0]} className="w-full h-48 object-cover rounded-xl" alt={l.title} />
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(!editing)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${editing ? "bg-[#C65D3B] text-white border-[#C65D3B]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
              <Pencil className="w-3.5 h-3.5" /> Редактировать
            </button>
            <a href={`/listings/${l.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
              <ExternalLink className="w-3.5 h-3.5" /> Открыть
            </a>
            <button onClick={async () => {
              const r = await fetch(`${API}/api/admin/listings/${l.id}`, {
                method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !l.is_available }),
              });
              if (r.ok) { toast({ title: l.is_available ? "Объявление скрыто" : "Объявление опубликовано" }); refresh(); onChanged(); }
            }} className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${l.is_available ? "border-stone-200 text-stone-600 hover:bg-stone-100" : "border-green-300 text-green-700 hover:bg-green-50"}`}>
              {l.is_available ? <><EyeOff className="w-3.5 h-3.5" /> Скрыть</> : <><Eye className="w-3.5 h-3.5" /> Опубликовать</>}
            </button>
            <button onClick={() => setDelConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Удалить
            </button>
          </div>

          {delConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-sm text-red-700">Удалить объявление и все связанные данные?</span>
              <div className="flex gap-2">
                <button onClick={() => setDelConfirm(false)} className="px-3 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg">Нет</button>
                <button onClick={deleteListing} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg">Удалить</button>
              </div>
            </div>
          )}

          {/* Info grid */}
          {!editing && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { l: "Владелец", v: `${l.owner_name} (${l.owner_email})` },
                { l: "Категория", v: l.category_name },
                { l: "Регион", v: l.region_name }, { l: "Город", v: l.city || "—" },
                { l: "Цена/день", v: formatPrice(parseFloat(l.price_per_day)) },
                { l: "Залог", v: l.deposit ? formatPrice(parseFloat(l.deposit)) : "—" },
                { l: "Добавлено", v: format(new Date(l.created_at), "dd.MM.yyyy") },
                { l: "Статус", v: l.is_available ? "Активно" : "Скрыто" },
              ].map(i => (
                <div key={i.l}><div className="text-stone-400 text-xs">{i.l}</div><div className="text-stone-700 font-medium">{i.v}</div></div>
              ))}
              {l.description && (
                <div className="col-span-2"><div className="text-stone-400 text-xs">Описание</div><div className="text-stone-700 text-sm line-clamp-3">{l.description}</div></div>
              )}
              {l.meeting_address && (
                <div className="col-span-2"><div className="text-stone-400 text-xs">Место передачи</div><div className="text-stone-700">{l.meeting_address}</div></div>
              )}
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2"><Pencil className="w-4 h-4" /> Редактирование</h4>
              {[
                { label: "Название", key: "title" },
                { label: "Цена в день (₽)", key: "pricePerDay", type: "number" },
                { label: "Залог (₽)", key: "deposit", type: "number" },
                { label: "Город", key: "city" },
                { label: "Место передачи", key: "meetingAddress" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-stone-600 font-medium block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
                </div>
              ))}
              <div>
                <label className="text-xs text-stone-600 font-medium block mb-1">Описание</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4}
                  className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                    className="rounded" />
                  <span className="text-sm text-stone-600">Активно (публичное)</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100">Отмена</button>
                <button onClick={saveEdit} disabled={saving}
                  className="px-4 py-1.5 text-sm bg-[#C65D3B] text-white rounded-lg hover:bg-[#b54f2f] disabled:opacity-50">
                  {saving ? "…" : "Сохранить"}
                </button>
              </div>
            </div>
          )}

          {/* Booking history */}
          {data?.bookings?.length > 0 && (
            <div>
              <h4 className="font-semibold text-stone-700 mb-2 text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4" /> История бронирований ({data.bookings.length})</h4>
              <div className="space-y-2">
                {data?.bookings?.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl text-sm">
                    <div className="font-mono text-xs text-stone-400 flex-shrink-0">{b.booking_number}</div>
                    <div className="flex-1 min-w-0 truncate text-stone-600">{b.renter_name}</div>
                    <div className="text-stone-500 text-xs flex-shrink-0">{b.start_date} — {b.end_date}</div>
                    <div className="font-medium text-stone-700 flex-shrink-0">{formatPrice(parseFloat(b.total_price))}</div>
                    <Badge cls={STATUS_COLORS[b.status] ?? "bg-stone-100 text-stone-600"} label={STATUS_LABEL[b.status] ?? b.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}

// ─── BookingOverrideModal ─────────────────────────────────────────────────────
function BookingOverrideModal({ booking, onClose, onDone }: {
  booking: AdminBooking | null; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (booking) setNewStatus(booking.status); }, [booking?.id]);

  async function submit() {
    if (!booking || !newStatus) return;
    setSaving(true);
    const r = await fetch(`${API}/api/admin/bookings/${booking.id}/override`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus, comment }),
    });
    setSaving(false);
    if (r.ok) {
      toast({ title: `Статус изменён: ${STATUS_LABEL[newStatus] ?? newStatus}` });
      onDone(); onClose();
    }
  }

  return (
    <Modal open={!!booking} onClose={onClose} title="Изменение статуса бронирования">
      {booking && (
        <div className="space-y-4">
          <div className="bg-stone-50 rounded-xl p-4 text-sm space-y-1">
            <div className="font-mono text-stone-400">{booking.bookingNumber}</div>
            <div className="font-semibold text-stone-800">{booking.listingTitle}</div>
            <div className="text-stone-500">{booking.renterName} → {booking.ownerName}</div>
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Текущий статус:</span>
              <Badge cls={STATUS_COLORS[booking.status] ?? ""} label={STATUS_LABEL[booking.status] ?? booking.status} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700 block mb-1">Новый статус</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30">
              {["pending","confirmed","active","return_pending","completed","cancelled","rejected"].map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700 block mb-1">Комментарий (необязательно)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="Причина изменения статуса…"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Обе стороны получат уведомление. Действие записывается в аудит-лог.
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Отмена</button>
            <button onClick={submit} disabled={saving || newStatus === booking.status}
              className="px-5 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] disabled:opacity-50 transition">
              {saving ? "…" : "Применить"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ onBroadcast }: { onBroadcast: () => void }) {
  const { data: stats } = useFetch<Stats>(`${API}/api/admin/stats`);
  const { data: analytics } = useFetch<any>(`${API}/api/admin/analytics`);

  const pieData = (analytics?.byStatus ?? []).map((s: any) => ({
    name: STATUS_LABEL[s.status] ?? s.status, value: Number(s.count),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-700">Сводка платформы</h3>
        <button onClick={onBroadcast}
          className="flex items-center gap-2 px-4 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] transition">
          <Megaphone className="w-4 h-4" /> Рассылка
        </button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Пользователей" value={Number(stats.users.totalUsers)}
              sub={`+${stats.users.newThisWeek} за неделю`} color="bg-blue-50 text-blue-600" />
            <StatCard icon={Package} label="Объявлений" value={Number(stats.listings.totalListings)}
              sub={`${stats.listings.active} активных`} color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={CalendarDays} label="Бронирований" value={Number(stats.bookings.totalBookings)}
              sub={`${stats.bookings.active} активных`} color="bg-orange-50 text-orange-600" />
            <StatCard icon={TrendingUp} label="Оборот (₽)" value={formatPrice(stats.revenue.total)}
              sub={`${formatPrice(stats.revenue.completed)} завершено`} color="bg-violet-50 text-violet-600" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Ожидают подтв." value={Number(stats.bookings.pending)} color="bg-yellow-50 text-yellow-600" />
            <StatCard icon={CheckCircle} label="Завершено" value={Number(stats.bookings.completed)} color="bg-green-50 text-green-600" />
            <StatCard icon={Ticket} label="Тикетов открыто" value={Number(stats.tickets.open)} color="bg-rose-50 text-rose-600"
              alert={(stats.tickets.open ?? 0) > 5} />
            <StatCard icon={Flag} label="Жалоб pending" value={Number(stats.reports?.pending ?? 0)} color="bg-amber-50 text-amber-600"
              alert={(stats.reports?.pending ?? 0) > 0} />
          </div>
        </>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bookings over 30d */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h4 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-stone-400" /> Бронирования за 30 дней</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics?.bookingsByDay?.map((d: any) => ({ day: d.day?.slice(5), count: Number(d.count) }))}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#C65D3B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* New users over 30d */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h4 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-stone-400" /> Регистрации за 30 дней</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics?.usersByDay?.map((d: any) => ({ day: d.day?.slice(5), count: Number(d.count) }))}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Booking statuses pie */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h4 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-stone-400" /> Статусы бронирований</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top listings */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h4 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-stone-400" /> Топ объявлений</h4>
            <div className="space-y-2">
              {analytics?.topListings?.slice(0, 5).map((l: any, i: number) => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-stone-400 text-xs font-bold">{i + 1}</span>
                  <a href={`/listings/${l.id}`} target="_blank" rel="noreferrer"
                    className="flex-1 truncate text-stone-700 hover:text-[#C65D3B] transition">{l.title}</a>
                  <span className="text-stone-400 text-xs">{l.bookings} аренд</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [roleFilter, setRoleFilter] = useState(""); const [bannedFilter, setBannedFilter] = useState("");
  const [page, setPage] = useState(1); const [rev, setRev] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const url = `${API}/api/admin/users?page=${page}&limit=20${dq ? `&q=${encodeURIComponent(dq)}` : ""}${roleFilter ? `&role=${roleFilter}` : ""}${bannedFilter ? `&banned=${bannedFilter}` : ""}`;
  const { data, loading } = useFetch<{ users: AdminUser[]; pagination: any }>(url, [rev, roleFilter, bannedFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по имени или email…"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все роли</option>
          <option value="renter">Арендаторы</option>
          <option value="owner">Владельцы</option>
          <option value="admin">Администраторы</option>
        </select>
        <select value={bannedFilter} onChange={e => { setBannedFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все статусы</option>
          <option value="false">Активные</option>
          <option value="true">Заблокированные</option>
        </select>
      </div>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Пользователь</th>
                <th className="px-4 py-3 text-left">Роль</th>
                <th className="px-4 py-3 text-center">Объявл.</th>
                <th className="px-4 py-3 text-center">Аренд.</th>
                <th className="px-4 py-3 text-center">Рейтинг</th>
                <th className="px-4 py-3 text-left">Рег.</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.users?.map(u => (
                <tr key={u.id} className={`${u.isBanned ? "bg-red-50" : "hover:bg-stone-50"} cursor-pointer`} onClick={() => setSelectedId(u.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 flex-shrink-0">
                        {u.avatar ? <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" /> : u.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-stone-800">{u.name}</div>
                        <div className="text-stone-400 text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge cls={u.role === "admin" ? "bg-[#C65D3B]/10 text-[#C65D3B]" : u.role === "owner" ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-stone-600"}
                      label={u.role === "admin" ? "Админ" : u.role === "owner" ? "Владелец" : "Арендатор"} />
                  </td>
                  <td className="px-4 py-3 text-center text-stone-600">{u.listingCount}</td>
                  <td className="px-4 py-3 text-center text-stone-600">{u.bookingCount}</td>
                  <td className="px-4 py-3 text-center text-stone-600">
                    {u.avgRating ? `★ ${Number(u.avgRating).toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{format(new Date(u.createdAt), "dd.MM.yy")}</td>
                  <td className="px-4 py-3">
                    {u.isBanned
                      ? <span className="text-xs text-red-600 flex items-center gap-1"><Ban className="w-3 h-3" /> Забл.</span>
                      : <span className="text-xs text-green-600 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Активен</span>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedId(u.id)}
                      className="text-xs px-3 py-1 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-100 transition">
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />
      <UserDetailPanel userId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => setRev(v => v + 1)} />
    </div>
  );
}

// ─── Listings Tab ─────────────────────────────────────────────────────────────
function ListingsTab() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [availableFilter, setAvailableFilter] = useState("");
  const [page, setPage] = useState(1); const [rev, setRev] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const url = `${API}/api/admin/listings?page=${page}&limit=20${dq ? `&q=${encodeURIComponent(dq)}` : ""}${availableFilter ? `&available=${availableFilter}` : ""}`;
  const { data, loading } = useFetch<{ listings: AdminListing[]; pagination: any }>(url, [rev, availableFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию…"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <select value={availableFilter} onChange={e => { setAvailableFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все</option>
          <option value="true">Активные</option>
          <option value="false">Скрытые</option>
        </select>
      </div>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Объявление</th>
                <th className="px-4 py-3 text-left">Владелец</th>
                <th className="px-4 py-3 text-right">Цена/день</th>
                <th className="px-4 py-3 text-center">Аренд.</th>
                <th className="px-4 py-3 text-center">Активных</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.listings?.map(l => (
                <tr key={l.id} className={`${!l.isActive ? "opacity-60" : "hover:bg-stone-50"} cursor-pointer`} onClick={() => setSelectedId(l.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {l.photos?.[0]
                        ? <img src={l.photos[0]} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-stone-200 flex-shrink-0" />}
                      <div>
                        <div className="font-medium text-stone-800 line-clamp-1">{l.title}</div>
                        <div className="text-stone-400 text-xs">{l.city || `ID ${l.id}`}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-stone-700">{l.ownerName}</div>
                    <div className="text-stone-400 text-xs">{l.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-stone-700">{formatPrice(l.pricePerDay)}</td>
                  <td className="px-4 py-3 text-center text-stone-600">{l.bookingCount}</td>
                  <td className="px-4 py-3 text-center">
                    {Number(l.activeBookings) > 0
                      ? <span className="text-green-600 font-medium">{l.activeBookings}</span>
                      : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.isActive
                      ? <span className="text-xs text-green-600 flex items-center gap-1"><Eye className="w-3 h-3" /> Активно</span>
                      : <span className="text-xs text-stone-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Скрыто</span>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedId(l.id)}
                      className="text-xs px-3 py-1 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-100 transition">
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />
      <ListingDetailPanel listingId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => setRev(v => v + 1)} />
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); const [page, setPage] = useState(1);
  const [overrideBooking, setOverrideBooking] = useState<AdminBooking | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const url = `${API}/api/admin/bookings?page=${page}&limit=20${dq ? `&q=${encodeURIComponent(dq)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`;
  const { data, loading } = useFetch<{ bookings: AdminBooking[]; pagination: any }>(url, [rev, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по номеру…"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все статусы</option>
          {["pending","confirmed","active","return_pending","completed","rejected","cancelled"].map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Номер</th>
                <th className="px-4 py-3 text-left">Объявление</th>
                <th className="px-4 py-3 text-left">Арендатор</th>
                <th className="px-4 py-3 text-left">Владелец</th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3 text-left">Период</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.bookings?.map(b => (
                <tr key={b.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{b.bookingNumber}</td>
                  <td className="px-4 py-3">
                    <a href={`/listings/${b.listingId}`} target="_blank" rel="noreferrer"
                      className="line-clamp-1 text-stone-700 hover:text-[#C65D3B] transition">{b.listingTitle}</a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-stone-700">{b.renterName}</div>
                    <div className="text-stone-400 text-xs">{b.renterEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-stone-700">{b.ownerName}</div>
                    <div className="text-stone-400 text-xs">{b.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-stone-700">{formatPrice(b.totalPrice)}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{b.startDate}<br />{b.endDate}</td>
                  <td className="px-4 py-3"><Badge cls={STATUS_COLORS[b.status] ?? ""} label={STATUS_LABEL[b.status] ?? b.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOverrideBooking(b)}
                      className="text-xs px-3 py-1.5 border border-[#C65D3B]/30 text-[#C65D3B] rounded-lg hover:bg-[#C65D3B]/5 transition font-medium">
                      Изменить статус
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />
      <BookingOverrideModal booking={overrideBooking} onClose={() => setOverrideBooking(null)} onDone={() => setRev(v => v + 1)} />
    </div>
  );
}

// ─── Support Tab ──────────────────────────────────────────────────────────────
function SupportTab() {
  const { toast } = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [rev, setRev] = useState(0);
  const [reply, setReply] = useState(""); const [replyStatus, setReplyStatus] = useState("in_progress");
  const [sending, setSending] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 400); return () => clearTimeout(t); }, [q]);

  const listUrl = `${API}/api/admin/tickets?page=${page}&limit=20${dq ? `&q=${encodeURIComponent(dq)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${priorityFilter ? `&priority=${priorityFilter}` : ""}`;
  const { data, loading } = useFetch<{ tickets: any[]; pagination: any }>(listUrl, [rev, statusFilter, priorityFilter]);

  const { data: detail, loading: detailLoading, refresh: refreshDetail } = useFetch<any>(selected ? `${API}/api/admin/tickets/${selected.id}` : null, [selected?.id, rev]);

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const r = await fetch(`${API}/api/admin/tickets/${selected.id}/reply`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, status: replyStatus }),
    });
    setSending(false);
    if (r.ok) { setReply(""); refreshDetail(); setRev(v => v + 1); toast({ title: "Ответ отправлен" }); }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    await fetch(`${API}/api/admin/tickets/${selected.id}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refreshDetail(); setRev(v => v + 1);
  }

  async function updatePriority(priority: string) {
    if (!selected) return;
    await fetch(`${API}/api/admin/tickets/${selected.id}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    refreshDetail(); setRev(v => v + 1);
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
          <ChevronLeft className="w-4 h-4" /> Все тикеты
        </button>
        {detailLoading || !detail ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="font-mono text-xs text-stone-400">{detail.ticket.ticketNumber}</div>
                  <h2 className="font-semibold text-stone-800 text-lg mt-0.5">{detail.ticket.subject}</h2>
                  <div className="text-sm text-stone-500 mt-1">
                    От: <strong>{detail.ticket.userName}</strong> ({detail.ticket.userEmail})
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge cls={STATUS_COLORS[detail.ticket.status] ?? ""} label={STATUS_LABEL[detail.ticket.status] ?? detail.ticket.status} />
                  <Badge cls="bg-stone-100 text-stone-600" label={CATEGORY_LABEL[detail.ticket.category] ?? detail.ticket.category} />
                  <select value={detail.ticket.priority} onChange={e => updatePriority(e.target.value)}
                    className="text-xs border border-stone-200 rounded px-2 py-1 bg-white">
                    {Object.keys(PRIORITY_LABEL).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                  </select>
                  <select value={detail.ticket.status} onChange={e => updateStatus(e.target.value)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
                    {["open","in_progress","resolved","closed"].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {detail?.messages?.map((m: any) => (
                <div key={m.id} className={`flex gap-3 ${m.isAdmin ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${m.isAdmin ? "bg-[#C65D3B] text-white" : "bg-stone-200 text-stone-600"}`}>
                    {m.isAdmin ? "A" : m.authorName?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className={`max-w-xl rounded-2xl px-4 py-3 ${m.isAdmin ? "bg-[#C65D3B] text-white rounded-tr-sm" : "bg-white border border-stone-200 text-stone-800 rounded-tl-sm"}`}>
                    <div className="text-xs opacity-70 mb-1">{m.isAdmin ? "Поддержка" : m.authorName} · {format(new Date(m.createdAt), "dd.MM HH:mm")}</div>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {detail.ticket.status !== "closed" && (
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4}
                  placeholder="Ваш ответ…"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
                <div className="flex items-center gap-3 justify-between flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">После ответа:</span>
                    <select value={replyStatus} onChange={e => setReplyStatus(e.target.value)}
                      className="text-xs border border-stone-200 rounded px-2 py-1 bg-white">
                      <option value="in_progress">В работе</option>
                      <option value="resolved">Решён</option>
                      <option value="closed">Закрыть</option>
                    </select>
                  </div>
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="px-4 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] disabled:opacity-50 transition">
                    Отправить ответ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по теме…"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все статусы</option>
          {["open","in_progress","resolved","closed"].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">Все приоритеты</option>
          {Object.keys(PRIORITY_LABEL).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Тикет</th>
                <th className="px-4 py-3 text-left">Пользователь</th>
                <th className="px-4 py-3 text-left">Категория</th>
                <th className="px-4 py-3 text-left">Приоритет</th>
                <th className="px-4 py-3 text-center">Сообщ.</th>
                <th className="px-4 py-3 text-left">Обновлён</th>
                <th className="px-4 py-3 text-left">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.tickets?.map((t: any) => (
                <tr key={t.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setSelected(t)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800 line-clamp-1">{t.subject}</div>
                    <div className="font-mono text-xs text-stone-400">{t.ticketNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-stone-700">{t.userName}</div>
                    <div className="text-stone-400 text-xs">{t.userEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{CATEGORY_LABEL[t.category] ?? t.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-stone-600">{t.messageCount}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{format(new Date(t.updatedAt), "dd.MM HH:mm")}</td>
                  <td className="px-4 py-3"><Badge cls={STATUS_COLORS[t.status] ?? ""} label={STATUS_LABEL[t.status] ?? t.status} /></td>
                </tr>
              ))}
              {!data?.tickets?.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">Тикетов нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1); const [rev, setRev] = useState(0);
  const [resolveModal, setResolveModal] = useState<{ id: number; action: "resolved" | "dismissed" } | null>(null);
  const [resolvedNote, setResolvedNote] = useState("");

  const url = `${API}/api/admin/reports?status=${statusFilter}&page=${page}&limit=20`;
  const { data, loading } = useFetch<{ reports: any[]; pagination: any }>(url, [rev, statusFilter]);

  async function handleResolve() {
    if (!resolveModal) return;
    const r = await fetch(`${API}/api/admin/reports/${resolveModal.id}`, {
      method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: resolveModal.action, resolvedNote }),
    });
    if (r.ok) {
      toast({ title: resolveModal.action === "resolved" ? "Жалоба закрыта" : "Жалоба отклонена" });
      setResolveModal(null); setResolvedNote(""); setRev(v => v + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {["pending","resolved","dismissed"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-lg border transition ${statusFilter === s ? "bg-[#C65D3B] text-white border-[#C65D3B]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
            {s === "pending" ? "🔴 Ожидают" : s === "resolved" ? "✅ Закрыты" : "⚪ Отклонены"}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="space-y-3">
          {!data?.reports?.length && <div className="text-center py-12 text-stone-400"><Flag className="w-10 h-10 mx-auto mb-2 opacity-30" />Жалоб нет</div>}
          {data?.reports?.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge cls={r.report_type === "listing" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}
                      label={r.report_type === "listing" ? "Объявление" : "Пользователь"} />
                    <Badge cls={STATUS_COLORS["pending_report"] ?? "bg-orange-100 text-orange-700"} label={REPORT_REASON_LABEL[r.reason] ?? r.reason} />
                    <span className="text-xs text-stone-400">{format(new Date(r.created_at), "dd.MM.yyyy HH:mm")}</span>
                  </div>

                  {r.reported_listing_title && (
                    <div className="text-sm">
                      <span className="text-stone-500">Объявление: </span>
                      <a href={`/listings/${r.reported_listing_id}`} target="_blank" rel="noreferrer"
                        className="font-medium text-[#C65D3B] hover:underline">{r.reported_listing_title}</a>
                    </div>
                  )}
                  {r.reported_user_name && (
                    <div className="text-sm">
                      <span className="text-stone-500">Пользователь: </span>
                      <span className="font-medium text-stone-700">{r.reported_user_name}</span>
                      <span className="text-stone-400 text-xs ml-1">({r.reported_user_email})</span>
                    </div>
                  )}
                  {r.detail && <div className="text-sm text-stone-600 mt-1 italic">"{r.detail}"</div>}
                  <div className="text-xs text-stone-400 mt-1">
                    Жалоба от: <span className="text-stone-600">{r.reporter_name}</span> ({r.reporter_email})
                  </div>
                </div>
                {statusFilter === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setResolveModal({ id: r.id, action: "resolved" }); setResolvedNote(""); }}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                      Закрыть
                    </button>
                    <button onClick={() => { setResolveModal({ id: r.id, action: "dismissed" }); setResolvedNote(""); }}
                      className="px-3 py-1.5 text-xs border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-100 transition">
                      Отклонить
                    </button>
                  </div>
                )}
                {statusFilter !== "pending" && r.resolved_by_admin_name && (
                  <div className="text-xs text-stone-400 text-right">
                    <div>{r.resolved_by_admin_name}</div>
                    {r.resolved_at && <div>{format(new Date(r.resolved_at), "dd.MM.yyyy")}</div>}
                    {r.resolved_note && <div className="text-stone-500 italic">"{r.resolved_note}"</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />

      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)}
        title={resolveModal?.action === "resolved" ? "Закрыть жалобу" : "Отклонить жалобу"}>
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            {resolveModal?.action === "resolved"
              ? "Отметить как обработанную. Укажите что было сделано."
              : "Жалоба необоснована или уже решена другим способом."}
          </p>
          <textarea value={resolvedNote} onChange={e => setResolvedNote(e.target.value)} rows={3}
            placeholder="Комментарий (необязательно)…"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setResolveModal(null)} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Отмена</button>
            <button onClick={handleResolve}
              className={`px-5 py-2 text-sm text-white rounded-lg transition ${resolveModal?.action === "resolved" ? "bg-green-600 hover:bg-green-700" : "bg-stone-600 hover:bg-stone-700"}`}>
              Подтвердить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────
function AuditLogTab() {
  const [page, setPage] = useState(1);
  const url = `${API}/api/admin/audit-log?page=${page}&limit=30`;
  const { data, loading } = useFetch<{ entries: any[]; pagination: any }>(url, [page]);

  const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    ban_user: { label: "Блокировка", color: "bg-red-100 text-red-700" },
    unban_user: { label: "Разблокировка", color: "bg-green-100 text-green-700" },
    edit_user: { label: "Ред. пользователя", color: "bg-blue-100 text-blue-700" },
    edit_listing: { label: "Ред. объявления", color: "bg-blue-100 text-blue-700" },
    delete_listing: { label: "Удаление", color: "bg-red-100 text-red-700" },
    override_booking: { label: "Смена статуса", color: "bg-orange-100 text-orange-700" },
    send_notification: { label: "Уведомление", color: "bg-violet-100 text-violet-700" },
    broadcast_notification: { label: "Рассылка", color: "bg-violet-100 text-violet-700" },
    resolved_report: { label: "Жалоба закрыта", color: "bg-green-100 text-green-700" },
    dismissed_report: { label: "Жалоба откл.", color: "bg-stone-100 text-stone-600" },
  };

  const ENTITY_ICONS: Record<string, string> = {
    user: "👤", listing: "📦", booking: "📅", ticket: "🎫", system: "⚡", report: "🚩",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Все действия администраторов на платформе</p>
      {loading ? <div className="text-center py-8 text-stone-400">Загрузка…</div> : (
        <div className="space-y-2">
          {data?.entries?.map((e: any) => {
            const meta = ACTION_LABELS[e.action] ?? { label: e.action, color: "bg-stone-100 text-stone-600" };
            return (
              <div key={e.id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex items-start gap-3">
                <div className="text-lg flex-shrink-0 mt-0.5">{ENTITY_ICONS[e.entity_type] ?? "🔧"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-sm font-medium text-stone-700">{e.admin_name}</span>
                    {e.entity_id && <span className="text-xs text-stone-400">#{e.entity_id}</span>}
                  </div>
                  {e.detail && <div className="text-sm text-stone-500 mt-0.5 truncate">{e.detail}</div>}
                </div>
                <div className="text-xs text-stone-400 flex-shrink-0">
                  {format(new Date(e.created_at), "dd.MM HH:mm")}
                </div>
              </div>
            );
          })}
          {!data?.entries?.length && <div className="text-center py-12 text-stone-400"><ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" />Действий пока нет</div>}
        </div>
      )}
      <Pagination page={page} pages={data?.pagination.pages ?? 1} onChange={setPage} />
    </div>
  );
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────
function ClaimsTab() {
  const API = import.meta.env.VITE_API_URL ?? "";
  const { data, loading, refresh } = useFetch<any[]>(`${API}/api/claims`, []);

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:     { label: "На рассмотрении", color: "bg-amber-100 text-amber-700" },
    reviewing:   { label: "Проверяется",     color: "bg-blue-100 text-blue-700" },
    approved:    { label: "Одобрена",         color: "bg-green-100 text-green-700" },
    paid:        { label: "Выплачено",        color: "bg-green-200 text-green-800" },
    rejected:    { label: "Отклонена",        color: "bg-red-100 text-red-700" },
  };

  const TYPE_LABEL: Record<string, string> = {
    damage: "Повреждение",
    theft:  "Кража",
  };

  const [processing, setProcessing] = useState<number | null>(null);

  async function handleAction(id: number, status: "approved" | "rejected", adminNote?: string) {
    setProcessing(id);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, adminNote }),
      });
      refresh?.();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Управление заявками Гарантийного фонда — возмещение ущерба арендодателям</p>
      {loading ? (
        <div className="text-center py-8 text-stone-400">Загрузка…</div>
      ) : !data?.length ? (
        <div className="text-center py-12 text-stone-400">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Заявок пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((claim: any) => {
            const cfg = STATUS_CONFIG[claim.status] ?? { label: claim.status, color: "bg-stone-100 text-stone-600" };
            return (
              <div key={claim.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-stone-400">#{claim.id}</span>
                      <span className="text-xs font-medium text-stone-600">{TYPE_LABEL[claim.type] ?? claim.type}</span>
                    </div>
                    <p className="text-sm text-stone-700">{claim.description}</p>
                    {claim.requestedAmount && (
                      <p className="text-xs text-stone-500">
                        Запрошено: <strong className="text-stone-800">{Number(claim.requestedAmount).toLocaleString("ru")} ₽</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 shrink-0">
                    {format(new Date(claim.createdAt), "dd.MM.yyyy HH:mm")}
                    <br />
                    <span className="text-stone-500">Бронирование #{claim.bookingId}</span>
                  </div>
                </div>

                {claim.evidenceUrl && (
                  <a href={claim.evidenceUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-primary underline break-all">
                    📎 Доказательство
                  </a>
                )}

                {claim.adminNote && (
                  <div className="bg-stone-50 rounded-lg p-2 text-xs text-stone-600 italic">
                    Заметка: {claim.adminNote}
                  </div>
                )}

                {claim.status === "pending" && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleAction(claim.id, "approved")}
                      disabled={processing === claim.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✓ Одобрить
                    </button>
                    <button
                      onClick={() => {
                        const note = prompt("Причина отклонения (необязательно):");
                        handleAction(claim.id, "rejected", note ?? undefined);
                      }}
                      disabled={processing === claim.id}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✕ Отклонить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── EconomyTab ────────────────────────────────────────────────────────────────
function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-stone-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-stone-500 mt-1">{hint}</div>}
    </label>
  );
}

function NumInput({ value, onChange, step = "1", suffix }: { value: any; onChange: (v: string) => void; step?: string; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B] text-stone-800"
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 pointer-events-none">{suffix}</span>}
    </div>
  );
}

function useSettingsForm() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [orig, setOrig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Не удалось загрузить настройки");
      const j = await res.json();
      setData(j); setOrig(j);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const dirty = data && orig && JSON.stringify(data) !== JSON.stringify(orig);

  const save = async () => {
    if (!data) return;
    // Нормализация: целочисленные поля → number, проценты/decimals → string-число, пустые строки → null
    const INT_FIELDS = new Set([
      "shieldFeeMin","riskCoverageMin","depositMin",
      "protMultElectronics","protMultTools","protMultLeisure","protMultSpecialMachinery",
      "newUserProtectionCap","newUserDealsThreshold",
      "vipPrice7d","vipPrice14d","vipPrice30d",
      "urgentPrice3d","urgentPrice7d","boostPrice24h",
      "subscriptionProMonthly","subscriptionBusinessMonthly",
    ]);
    const DEC_FIELDS = new Set([
      "serviceFeePercent","taxFeePercent","shieldFeePercent","riskCoveragePercent",
      "subscriptionBusinessCommissionPercent","jointPurchaseFeePercent","depositMultiplier",
    ]);
    const NULLABLE_STR = new Set(["yookassaShopId","sbpMerchantId","cloudpaymentsPublicId"]);
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || k === "updatedAt" || k === "updatedBy") continue;
      if (INT_FIELDS.has(k)) {
        if (v === "" || v === null || v === undefined) {
          toast({ title: "Ошибка", description: `Поле "${k}" не должно быть пустым`, variant: "destructive" });
          return;
        }
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          toast({ title: "Ошибка", description: `Поле "${k}": нужно целое неотрицательное число`, variant: "destructive" });
          return;
        }
        payload[k] = n;
      } else if (DEC_FIELDS.has(k)) {
        const n = parseFloat(String(v));
        if (!Number.isFinite(n) || n < 0) {
          toast({ title: "Ошибка", description: `Поле "${k}": нужно неотрицательное число`, variant: "destructive" });
          return;
        }
        payload[k] = String(n);
      } else if (NULLABLE_STR.has(k)) {
        payload[k] = (v === "" || v === undefined) ? null : v;
      } else {
        payload[k] = v;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || "Ошибка сохранения");
      }
      const j = await res.json();
      setData(j); setOrig(j);
      toast({ title: "Сохранено", description: "Настройки применятся в течение минуты" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const reset = () => setData(orig);

  return { data, set, dirty, save, reset, loading, saving };
}

function SettingsActionBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-10 bg-white border border-amber-300 rounded-xl shadow-lg p-3 flex items-center justify-between mt-6">
      <div className="text-sm text-stone-700">Есть несохранённые изменения</div>
      <div className="flex gap-2">
        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-medium text-stone-700">
          <RotateCcw className="w-4 h-4" /> Отменить
        </button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#C65D3B] hover:bg-[#b04f30] disabled:opacity-60 rounded-lg text-sm font-medium text-white">
          <Save className="w-4 h-4" /> {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function EconomyTab() {
  const { data, set, dirty, save, reset, loading, saving } = useSettingsForm();
  if (loading) return <div className="text-stone-500">Загрузка…</div>;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Комиссии и налоги</h2>
        <p className="text-sm text-stone-500 mb-4">Скрытая комиссия и налог удерживаются с владельца из суммы аренды</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Сервисный сбор" hint="С владельца, % от аренды">
            <NumInput step="0.1" suffix="%" value={data.serviceFeePercent} onChange={v => set("serviceFeePercent", v)} />
          </SettingsField>
          <SettingsField label="Налоговая удержка" hint="Самозанятость 6% / ИП 4% / ООО — настраивается">
            <NumInput step="0.1" suffix="%" value={data.taxFeePercent} onChange={v => set("taxFeePercent", v)} />
          </SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Безопасная сделка (Shield)</h2>
        <p className="text-sm text-stone-500 mb-4">Shield Fee платит арендатор сверху; Risk Coverage удерживается с владельца</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Shield Fee, %" hint="Сверху к оплате арендатора">
            <NumInput step="0.1" suffix="%" value={data.shieldFeePercent} onChange={v => set("shieldFeePercent", v)} />
          </SettingsField>
          <SettingsField label="Shield Fee, минимум ₽">
            <NumInput suffix="₽" value={data.shieldFeeMin} onChange={v => set("shieldFeeMin", v)} />
          </SettingsField>
          <SettingsField label="Risk Coverage, %" hint="С выплаты владельца">
            <NumInput step="0.1" suffix="%" value={data.riskCoveragePercent} onChange={v => set("riskCoveragePercent", v)} />
          </SettingsField>
          <SettingsField label="Risk Coverage, минимум ₽">
            <NumInput suffix="₽" value={data.riskCoverageMin} onChange={v => set("riskCoverageMin", v)} />
          </SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Залог по умолчанию</h2>
        <p className="text-sm text-stone-500 mb-4">Когда владелец не задал свой залог: max(минимум, цена/день × множитель)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Множитель (дней цены)">
            <NumInput step="0.1" value={data.depositMultiplier} onChange={v => set("depositMultiplier", v)} />
          </SettingsField>
          <SettingsField label="Минимум залога">
            <NumInput suffix="₽" value={data.depositMin} onChange={v => set("depositMin", v)} />
          </SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Лимиты страхового покрытия</h2>
        <p className="text-sm text-stone-500 mb-4">Множитель цены/день для расчёта max выплаты по категории</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Электроника"><NumInput suffix="× цены" value={data.protMultElectronics} onChange={v => set("protMultElectronics", v)} /></SettingsField>
          <SettingsField label="Инструменты"><NumInput suffix="× цены" value={data.protMultTools} onChange={v => set("protMultTools", v)} /></SettingsField>
          <SettingsField label="Отдых"><NumInput suffix="× цены" value={data.protMultLeisure} onChange={v => set("protMultLeisure", v)} /></SettingsField>
          <SettingsField label="Спецтехника"><NumInput suffix="× цены" value={data.protMultSpecialMachinery} onChange={v => set("protMultSpecialMachinery", v)} /></SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Новые пользователи</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Лимит покрытия для новичков">
            <NumInput suffix="₽" value={data.newUserProtectionCap} onChange={v => set("newUserProtectionCap", v)} />
          </SettingsField>
          <SettingsField label="Снять лимит после N сделок">
            <NumInput value={data.newUserDealsThreshold} onChange={v => set("newUserDealsThreshold", v)} />
          </SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Платное продвижение</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SettingsField label="VIP, 7 дней"><NumInput suffix="₽" value={data.vipPrice7d} onChange={v => set("vipPrice7d", v)} /></SettingsField>
          <SettingsField label="VIP, 14 дней"><NumInput suffix="₽" value={data.vipPrice14d} onChange={v => set("vipPrice14d", v)} /></SettingsField>
          <SettingsField label="VIP, 30 дней"><NumInput suffix="₽" value={data.vipPrice30d} onChange={v => set("vipPrice30d", v)} /></SettingsField>
          <SettingsField label="Срочно, 3 дня"><NumInput suffix="₽" value={data.urgentPrice3d} onChange={v => set("urgentPrice3d", v)} /></SettingsField>
          <SettingsField label="Срочно, 7 дней"><NumInput suffix="₽" value={data.urgentPrice7d} onChange={v => set("urgentPrice7d", v)} /></SettingsField>
          <SettingsField label="Boost, 24 часа"><NumInput suffix="₽" value={data.boostPrice24h} onChange={v => set("boostPrice24h", v)} /></SettingsField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Подписки и совместные покупки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="PRO подписка / месяц"><NumInput suffix="₽" value={data.subscriptionProMonthly} onChange={v => set("subscriptionProMonthly", v)} /></SettingsField>
          <SettingsField label="Business подписка / месяц"><NumInput suffix="₽" value={data.subscriptionBusinessMonthly} onChange={v => set("subscriptionBusinessMonthly", v)} /></SettingsField>
          <SettingsField label="Business: пониженная комиссия"><NumInput step="0.1" suffix="%" value={data.subscriptionBusinessCommissionPercent} onChange={v => set("subscriptionBusinessCommissionPercent", v)} /></SettingsField>
          <SettingsField label="Сбор за совместные покупки"><NumInput step="0.1" suffix="%" value={data.jointPurchaseFeePercent} onChange={v => set("jointPurchaseFeePercent", v)} /></SettingsField>
        </div>
      </div>

      <SettingsActionBar dirty={!!dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

// ─── PaymentsTab ───────────────────────────────────────────────────────────────
function PaymentsTab() {
  const { data, set, dirty, save, reset, loading, saving } = useSettingsForm();
  if (loading) return <div className="text-stone-500">Загрузка…</div>;
  if (!data) return null;
  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <span className={`w-10 h-6 rounded-full relative transition ${checked ? "bg-[#C65D3B]" : "bg-stone-300"}`}>
        <span className={`absolute top-0.5 ${checked ? "right-0.5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition`} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm font-medium text-stone-700">{label}</span>
    </label>
  );
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Налоговая модель</h2>
        <p className="text-sm text-stone-500 mb-4">Определяет ставку налога и формат чеков</p>
        <select
          value={data.paymentMode}
          onChange={e => set("paymentMode", e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B] text-stone-800"
        >
          <option value="self_employed">Самозанятость (НПД 6%)</option>
          <option value="ip">ИП на УСН</option>
          <option value="ooo">ООО (агентская схема)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">ЮKassa</h2>
            <p className="text-sm text-stone-500">Карты, СБП, ЮMoney. Секреты — в переменных окружения сервера</p>
          </div>
          <Toggle checked={!!data.yookassaEnabled} onChange={v => set("yookassaEnabled", v)} label={data.yookassaEnabled ? "Вкл" : "Выкл"} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Shop ID" hint="Публичный идентификатор магазина">
            <input type="text" value={data.yookassaShopId ?? ""} onChange={e => set("yookassaShopId", e.target.value || null)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B] text-stone-800" />
          </SettingsField>
          <div className="flex items-end">
            <Toggle checked={!!data.yookassaTestMode} onChange={v => set("yookassaTestMode", v)} label="Тестовый режим" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">СБП напрямую</h2>
            <p className="text-sm text-stone-500">Прямой эквайринг через банк-партнёр</p>
          </div>
          <Toggle checked={!!data.sbpEnabled} onChange={v => set("sbpEnabled", v)} label={data.sbpEnabled ? "Вкл" : "Выкл"} />
        </div>
        <SettingsField label="Merchant ID">
          <input type="text" value={data.sbpMerchantId ?? ""} onChange={e => set("sbpMerchantId", e.target.value || null)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B] text-stone-800" />
        </SettingsField>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">CloudPayments</h2>
            <p className="text-sm text-stone-500">Резервный шлюз с холдированием для безопасных сделок</p>
          </div>
          <Toggle checked={!!data.cloudpaymentsEnabled} onChange={v => set("cloudpaymentsEnabled", v)} label={data.cloudpaymentsEnabled ? "Вкл" : "Выкл"} />
        </div>
        <SettingsField label="Public ID">
          <input type="text" value={data.cloudpaymentsPublicId ?? ""} onChange={e => set("cloudpaymentsPublicId", e.target.value || null)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B] text-stone-800" />
        </SettingsField>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        Секретные ключи (api_key, signing_secret) хранятся в переменных окружения сервера и не редактируются из админки.
      </div>

      <SettingsActionBar dirty={!!dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

// ─── Main AdminPage ────────────────────────────────────────────────────────────
type Tab = "overview" | "users" | "listings" | "bookings" | "support" | "reports" | "claims" | "audit" | "economy" | "payments";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "users", label: "Пользователи", icon: Users },
  { id: "listings", label: "Объявления", icon: Package },
  { id: "bookings", label: "Бронирования", icon: CalendarDays },
  { id: "economy", label: "Экономика", icon: Coins },
  { id: "payments", label: "Платежи", icon: CreditCard },
  { id: "support", label: "Поддержка", icon: LifeBuoy },
  { id: "reports", label: "Жалобы", icon: Flag },
  { id: "claims", label: "Заявки фонда", icon: Shield },
  { id: "audit", label: "Аудит", icon: ScrollText },
];

export default function AdminPage() {
  const { data: currentUser, isLoading } = useGetCurrentUser();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!currentUser || (currentUser as any).role !== "admin")) navigate("/");
  }, [currentUser, isLoading]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-8 h-8 border-2 border-[#C65D3B] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!currentUser || (currentUser as any).role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#C65D3B] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Панель управления</h1>
            <p className="text-stone-500 text-sm">Администратор: {(currentUser as any).name}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                tab === t.id ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}>
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab onBroadcast={() => setBroadcastOpen(true)} />}
        {tab === "users" && <UsersTab />}
        {tab === "listings" && <ListingsTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "support" && <SupportTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "claims" && <ClaimsTab />}
        {tab === "audit" && <AuditLogTab />}
        {tab === "economy" && <EconomyTab />}
        {tab === "payments" && <PaymentsTab />}
      </div>

      <BroadcastModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
    </Layout>
  );
}
