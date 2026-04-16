import { useState, useEffect, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { LifeBuoy, Plus, ChevronLeft, Send, X, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const API = import.meta.env.VITE_API_URL ?? "";

interface SupportTicket {
  id: number; ticketNumber: string; subject: string;
  category: string; status: string; priority: string;
  messageCount: number; createdAt: string; updatedAt: string;
}
interface TicketMessage {
  id: number; body: string; isAdmin: boolean;
  authorId: number; authorName: string; authorAvatar?: string;
  createdAt: string;
}
interface TicketDetail {
  ticket: SupportTicket;
  messages: TicketMessage[];
}

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-stone-100 text-stone-500",
};
const statusLabel: Record<string, string> = {
  open: "Открыт", in_progress: "В работе", resolved: "Решён", closed: "Закрыт",
};
const categoryLabel: Record<string, string> = {
  general: "Общий", dispute: "Спор", technical: "Техническая", billing: "Оплата",
};

export function SupportSection({ initialTicketId }: { initialTicketId?: number }) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Create ticket form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadTickets() {
    setLoading(true);
    const r = await fetch(`${API}/api/support/tickets`, { headers: getAuthHeaders() });
    if (r.ok) setTickets(await r.json());
    setLoading(false);
  }

  async function loadDetail(id: number) {
    const r = await fetch(`${API}/api/support/tickets/${id}`, { headers: getAuthHeaders() });
    if (r.ok) setSelected(await r.json());
  }

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    if (initialTicketId && tickets.length > 0) {
      const t = tickets.find(t => t.id === initialTicketId);
      if (t) loadDetail(t.id);
    }
  }, [initialTicketId, tickets]);

  useEffect(() => {
    if (selected) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setCreating(true);
    const r = await fetch(`${API}/api/support/tickets`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ subject, category, body }),
    });
    setCreating(false);
    if (r.ok) {
      toast({ title: "Тикет создан", description: "Мы ответим в ближайшее время" });
      setShowCreate(false); setSubject(""); setCategory("general"); setBody("");
      await loadTickets();
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const r = await fetch(`${API}/api/support/tickets/${selected.ticket.id}/reply`, {
      method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    setSending(false);
    if (r.ok) { setReply(""); await loadDetail(selected.ticket.id); await loadTickets(); }
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelected(null); loadTickets(); }}
          className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
          <ChevronLeft className="w-4 h-4" /> К списку тикетов
        </button>

        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-xs text-stone-400">{selected.ticket.ticketNumber}</div>
              <h3 className="font-semibold text-stone-800 mt-0.5">{selected.ticket.subject}</h3>
              <div className="text-xs text-stone-500 mt-1">{categoryLabel[selected.ticket.category]}</div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[selected.ticket.status]}`}>
              {statusLabel[selected.ticket.status]}
            </span>
          </div>
        </div>

        <div className="space-y-3 min-h-[100px]">
          {selected.messages.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.isAdmin ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${m.isAdmin ? "bg-[#C65D3B] text-white" : "bg-stone-200 text-stone-600"}`}>
                {m.isAdmin ? "П" : (m.authorName?.[0]?.toUpperCase() ?? "U")}
              </div>
              <div className={`max-w-lg rounded-2xl px-4 py-3 ${m.isAdmin
                ? "bg-[#C65D3B] text-white rounded-tr-sm"
                : "bg-stone-100 text-stone-800 rounded-tl-sm"}`}>
                <div className="text-xs opacity-60 mb-1">
                  {m.isAdmin ? "Служба поддержки" : "Вы"} · {format(new Date(m.createdAt), "dd.MM HH:mm")}
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {selected.ticket.status !== "closed" ? (
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Добавить сообщение…" rows={3}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
            <div className="flex justify-end">
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] disabled:opacity-50 transition">
                <Send className="w-4 h-4" /> Отправить
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-stone-400 text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Тикет закрыт
          </div>
        )}
      </div>
    );
  }

  // ── Create form ──────────────────────────────────────────────────────────────
  if (showCreate) {
    return (
      <div className="space-y-4">
        <button onClick={() => setShowCreate(false)}
          className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-800 text-lg mb-4 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-[#C65D3B]" /> Новый запрос в поддержку
          </h3>
          <form onSubmit={createTicket} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Категория</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30">
                <option value="general">Общий вопрос</option>
                <option value="dispute">Спор по аренде</option>
                <option value="technical">Техническая проблема</option>
                <option value="billing">Вопрос об оплате</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Тема</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Кратко опишите вопрос…" required
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Сообщение</label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder="Подробно опишите вашу проблему или вопрос…" required rows={5}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/30" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Отмена</button>
              <button type="submit" disabled={creating}
                className="px-6 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] disabled:opacity-50 transition">
                {creating ? "Отправка…" : "Отправить запрос"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Ticket list ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800 text-lg">Служба поддержки</h3>
          <p className="text-sm text-stone-500">Ваши обращения и вопросы</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C65D3B] text-white text-sm rounded-lg hover:bg-[#b54f2f] transition">
          <Plus className="w-4 h-4" /> Новый запрос
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-stone-400">Загрузка…</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <LifeBuoy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Обращений пока нет</p>
          <p className="text-sm mt-1">Если у вас возник вопрос — нажмите «Новый запрос»</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <button key={t.id} onClick={() => loadDetail(t.id)}
              className="w-full bg-white rounded-xl border border-stone-200 p-4 text-left hover:border-[#C65D3B]/40 hover:bg-stone-50 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800 truncate">{t.subject}</div>
                  <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{t.ticketNumber}</span>
                    <span>·</span>
                    <span>{categoryLabel[t.category]}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3 inline" /> {format(new Date(t.updatedAt), "dd.MM HH:mm")}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.messageCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <MessageSquare className="w-3 h-3" /> {t.messageCount}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[t.status]}`}>
                    {statusLabel[t.status]}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
