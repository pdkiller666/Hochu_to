import { Layout } from "@/components/layout/Layout";
import { useAuthState, getToken, removeToken } from "@/lib/auth";
import {
  useGetCurrentUser,
  useGetUserById,
  useGetUserListings,
  useGetMyBookings,
  useGetRegions,
  useUpdateBookingStatus,
  useUpdateUserProfile,
  useDeleteListing,
  useUpdateListing,
  AppNotification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { useEffect, useState, useCallback, Fragment, type ReactNode } from "react";
import {
  Loader2, Plus, Package, Clock, CheckCircle2, XCircle, RefreshCw,
  Settings, Camera, ArrowDownCircle, ArrowUpCircle, PhoneCall, Phone,
  Trash2, Eye, EyeOff, ListFilter, LayoutGrid, ArrowUpDown,
  Globe, Send, User, CalendarDays, Star, ShoppingBag, BadgeCheck,
  TrendingUp, TrendingDown, MessageSquare, Leaf, PiggyBank, Wind, MapPin, LifeBuoy,
  Wallet, Infinity as InfinityIcon, Gift,
  Coins, ArrowDownToLine, ArrowUpFromLine, ShieldCheck, Banknote,
  Shield, KeyRound, ScrollText, Activity, ExternalLink, BarChart2, ChevronRight,
  CreditCard, Smartphone, X, Star as StarIcon, ShieldAlert, AlertTriangle, FileText,
  Crown, Zap, Sparkles, Award,
} from "lucide-react";
import PromoteListingModal from "@/components/PromoteListingModal";
import { DigitalActUpload, type DigitalActKind } from "@/components/DigitalActUpload";
import { formatPrice } from "@/lib/utils";
import { SBP_BANKS, getSbpBankName, formatPhoneMask, extractCleanPhone } from "@/lib/sbp-banks";
import { format } from "date-fns";
import { StarRating } from "@/components/ui/StarRating";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { SupportSection } from "@/components/ui/SupportSection";
import { usePersistedState } from "@/lib/use-persisted-state";
import { useToast } from "@/hooks/use-toast";
import { usePublicSettings } from "@/lib/use-public-settings";
import { useWs } from "@/lib/use-websocket";

type BookingStatusFilter = "all" | "pending" | "confirmed" | "active" | "return_pending" | "completed" | "rejected" | "cancelled";
type ListingVisFilter = "all" | "active" | "hidden";

// ─── DeadlineTimer ────────────────────────────────────────────────────────────
// Defined outside Dashboard so React never remounts it on parent re-renders,
// keeping the interval alive and ticking every second.
function DeadlineTimer({
  deadlineMs,
  totalMs,
  label,
}: {
  deadlineMs: number;
  totalMs: number;
  label: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Tick every second when < 1 h left, otherwise every minute
    const ms = deadlineMs - Date.now() < 3_600_000 ? 1_000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const remaining  = Math.max(0, deadlineMs - now);
  const elapsed    = Math.max(0, now - (deadlineMs - totalMs));
  const pct        = Math.min(100, Math.round((elapsed / totalMs) * 100));

  const isOverdue  = remaining === 0 && now > deadlineMs;
  const isUrgent   = !isOverdue && remaining < 2 * 3_600_000;
  const isWarning  = !isOverdue && !isUrgent && remaining < 12 * 3_600_000;

  const d = Math.floor(remaining / 86_400_000);
  const h = Math.floor((remaining % 86_400_000) / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);

  const display = isOverdue
    ? "Срок истёк"
    : d > 0
    ? `${d}д ${h}ч ${m.toString().padStart(2, "0")}м`
    : `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  const c = isOverdue
    ? { text: "text-red-600",     bar: "bg-red-500",     ring: "border-red-200",    bg: "bg-red-50"    }
    : isUrgent
    ? { text: "text-red-500",     bar: "bg-red-400",     ring: "border-red-200",    bg: "bg-red-50"    }
    : isWarning
    ? { text: "text-amber-600",   bar: "bg-amber-400",   ring: "border-amber-200",  bg: "bg-amber-50"  }
    : { text: "text-emerald-700", bar: "bg-emerald-400", ring: "border-emerald-200",bg: "bg-emerald-50"};

  return (
    <div className={`rounded-xl border ${c.ring} ${c.bg} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1.5">
        <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
        <span className={`text-sm font-bold font-mono tabular-nums shrink-0 ${c.text}`}>
          {display}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-black/5 mx-3 mb-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar} ${(isUrgent || isOverdue) ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%`, transition: "width 1s linear" }}
        />
      </div>
    </div>
  );
}

// ─── ChatInputRow ─────────────────────────────────────────────────────────────
// Isolated component so that typing does NOT re-render Dashboard.
// On mobile this prevents the keyboard from dismissing on every keystroke.
function ChatInputRow({
  onSend,
  chatSending,
  resetKey,
}: {
  onSend: (content: string) => void;
  chatSending: boolean;
  resetKey: number;
}) {
  const [value, setValue] = useState("");

  // When resetKey changes (chat closed/reopened), clear the field
  useEffect(() => { setValue(""); }, [resetKey]);

  const handleSend = () => {
    const content = value.trim();
    if (!content || chatSending) return;
    onSend(content);
    setValue("");
  };

  return (
    <div className="flex gap-2 items-end">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Написать сообщение…"
        className="flex-1 px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[42px] leading-snug"
        maxLength={2000}
        rows={1}
      />
      <button
        onClick={handleSend}
        disabled={chatSending || !value.trim()}
        className="shrink-0 w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors disabled:opacity-50"
      >
        {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { isAuthenticated, token } = useAuthState();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const search = useSearch();
  const initialTab = new URLSearchParams(search).get("tab");

  // Tri-state: settings ещё не загружены → ведём себя как commercial.
  // В Бета-режиме скрываем коммерч. вкладки/CTA/promo-бейджи.
  const publicSettings = usePublicSettings();
  const isBetaMode = publicSettings?.isCommercialMode === false;
  const isCommercialMode = !isBetaMode;

  type DashTab = "incoming" | "outgoing" | "listings" | "profile" | "history" | "support" | "contacts" | "finance" | "wallet";
  // В Бета-режиме «finance», «contacts» и «wallet» выключены полностью.
  const baseTabs: DashTab[] = ["incoming", "outgoing", "listings", "profile", "history", "support"];
  const validTabs: DashTab[] = isBetaMode ? baseTabs : [...baseTabs, "contacts", "finance", "wallet"];
  const urlTab = initialTab && validTabs.includes(initialTab as DashTab) ? (initialTab as DashTab) : null;
  const [activeTab, setActiveTab] = usePersistedState<DashTab>("dashboard_tab", urlTab ?? "incoming");
  // URL-параметр tab всегда берёт приоритет над сохранённым значением
  useEffect(() => { if (urlTab) setActiveTab(urlTab); }, []);
  // Если settings прилетели позже и пользователь сидит на коммерч. вкладке в beta — переключаем.
  useEffect(() => {
    if (isBetaMode && (activeTab === "finance" || activeTab === "contacts" || activeTab === "wallet")) {
      setActiveTab("incoming");
    }
  }, [isBetaMode, activeTab, setActiveTab]);

  const [incomingFilter, setIncomingFilter] = usePersistedState<BookingStatusFilter>("dashboard_incoming_filter", "all");
  const [outgoingFilter, setOutgoingFilter] = usePersistedState<BookingStatusFilter>("dashboard_outgoing_filter", "all");
  const [listingFilter, setListingFilter] = usePersistedState<ListingVisFilter>("dashboard_listing_filter", "all");

  // Review state (history tab)
  const DASHBOARD_API = import.meta.env.VITE_API_URL ?? "";
  const [reviewingBooking, setReviewingBooking] = useState<{ id: number; role: "renter" | "owner"; number?: string; listingId?: number; partnerId?: number } | null>(null);
  const [submitClaimBooking, setSubmitClaimBooking] = useState<{ id: number; bookingNumber?: string | null; listingTitle?: string | null; maxProtectionLimit?: number | null } | null>(null);
  const [claimRefreshNonce, setClaimRefreshNonce] = useState(0);
  // Stage 22a — модалка Цифрового акта (Check-in / Check-out)
  const [digitalActModal, setDigitalActModal] = useState<{ bookingId: number; type: DigitalActKind } | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const handleOpenReview = (booking: any, role: "renter" | "owner") => {
    setReviewingBooking({ id: booking.id, role, number: booking.bookingNumber, listingId: booking.listingId, partnerId: role === "renter" ? booking.ownerId : booking.renterId });
    setReviewRating(0);
    setReviewHover(0);
    setReviewText("");
  };

  const handleSubmitDashboardReview = async () => {
    if (!reviewingBooking || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${DASHBOARD_API}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bookingId: reviewingBooking.id,
          reviewType: reviewingBooking.role === "renter" ? "listing" : "renter",
          rating: reviewRating,
          text: reviewText.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReviewedIds(prev => new Set([...prev, reviewingBooking.id]));
        setReviewingBooking(null);
      } else if (res.status === 409) {
        // Уже оставлен — синхронизируем UI и закрываем
        setReviewedIds(prev => new Set([...prev, reviewingBooking.id]));
        setReviewingBooking(null);
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  type IncomingSort = "newest" | "start_asc" | "price_desc" | "pending_first";
  type OutgoingSort = "newest" | "start_asc" | "price_desc" | "active_first";
  const [incomingSort, setIncomingSort] = usePersistedState<IncomingSort>("dashboard_incoming_sort", "pending_first");
  const [outgoingSort, setOutgoingSort] = usePersistedState<OutgoingSort>("dashboard_outgoing_sort", "newest");

  const [profileForm, setProfileForm] = useState({
    name: "", phone: "", role: "renter" as "renter" | "owner",
    regionId: undefined as number | undefined,
    bio: "", telegram: "", website: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  // Stage 38 — Telegram OTP linking
  const [tgLinked, setTgLinked] = useState(false);
  const [tgOtp, setTgOtp] = useState<{ otp: string; expiresAt: string } | null>(null);
  const [tgPrefs, setTgPrefs] = useState({ bookings: true, system: true, chats: true });
  const [tgBusy, setTgBusy] = useState(false);
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);
  // Stage 38-UE — Phone Verification via SMS
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpExpiresAt, setPhoneOtpExpiresAt] = useState<string | null>(null);
  const [phoneOtpInput, setPhoneOtpInput] = useState("");
  const [phoneOtpBusy, setPhoneOtpBusy] = useState(false);
  // Stage 19g — Trust & Verification: модалка подачи заявки на бейдж «Проверенный владелец».
  const { toast } = useToast();
  const [verifModalOpen, setVerifModalOpen] = useState(false);
  const [verifBody, setVerifBody] = useState("");
  const [verifSubmitting, setVerifSubmitting] = useState(false);
  // Stage 20a — отслеживаем открытую заявку на верификацию (для отображения «Отозвать»)
  const [verifPendingTicketId, setVerifPendingTicketId] = useState<number | null>(null);
  const [verifCancelling, setVerifCancelling] = useState(false);
  const [credForm, setCredForm] = useState({ newEmail: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [credSaved, setCredSaved] = useState(false);
  const [credError, setCredError] = useState("");
  const [credPending, setCredPending] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ bookingId: number } | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  // Guard modals — protect premature / accidental status changes
  type GuardType = "early_handover" | "early_return" | "cancel_confirm";
  const [guardModal, setGuardModal] = useState<{
    type: GuardType;
    booking: NonNullable<typeof bookings>[0];
    cancellerRole?: "owner" | "renter";
  } | null>(null);

  // Reschedule form (shown inside early_handover guard modal)
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");
  const [rescheduleErr, setRescheduleErr] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const closeGuard = () => { setGuardModal(null); setRescheduleMode(false); setRescheduleErr(""); };

  // ── Chat state ─────────────────────────────────────────────────────────────
  type ChatMessage = { id: number; bookingId: number; senderId: number; content: string; isRead: boolean; createdAt: string };
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [chatSending, setChatSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [chatResetKey, setChatResetKey] = useState(0);

  const { isConnected, subscribe } = useWs();

  const fetchMessages = useCallback(async (bookingId: number, silent = false) => {
    try {
      const res = await fetch(`${DASHBOARD_API}/api/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const msgs: ChatMessage[] = await res.json();
        setChatMessages((prev) => ({ ...prev, [bookingId]: msgs }));
        setUnreadCounts((prev) => ({ ...prev, [bookingId]: 0 }));
      }
    } catch { if (!silent) console.error("Ошибка загрузки сообщений"); }
  }, [DASHBOARD_API]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch(`${DASHBOARD_API}/api/messages/unread-counts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const counts: Record<number, number> = await res.json();
        setUnreadCounts((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(counts)) {
            const id = Number(k);
            if (openChatId !== id) next[id] = v;
          }
          return next;
        });
      }
    } catch { /* silent */ }
  }, [DASHBOARD_API, openChatId]);

  // Stage 34: fetch on mount + refetch when WS reconnects (catch missed messages)
  useEffect(() => { fetchUnreadCounts(); }, [fetchUnreadCounts, isConnected]);

  // Stage 34: fetch messages on open + refetch on reconnect (no polling)
  useEffect(() => {
    if (openChatId === null) return;
    fetchMessages(openChatId);
  }, [openChatId, fetchMessages, isConnected]);

  // Stage 34: push incoming messages reactively from WebSocket
  useEffect(() => {
    return subscribe("NEW_MESSAGE", (payload) => {
      const msg = payload as ChatMessage;
      // Add to open chat immediately; increment unread badge for closed chats
      setChatMessages((prev) => {
        const existing = prev[msg.bookingId] ?? [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.bookingId]: [...existing, msg] };
      });
      if (openChatId !== msg.bookingId) {
        setUnreadCounts((prev) => ({ ...prev, [msg.bookingId]: (prev[msg.bookingId] ?? 0) + 1 }));
      }
    });
  }, [subscribe, openChatId]);

  // Scroll chat panel into view when opened
  useEffect(() => {
    if (openChatId === null) return;
    const el = document.getElementById(`chat-panel-${openChatId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openChatId]);

  async function sendChatMessage(bookingId: number, content: string) {
    if (!content || chatSending) return;
    setChatSending(true);
    try {
      const res = await fetch(`${DASHBOARD_API}/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        await fetchMessages(bookingId);
      }
    } catch { /* silent */ } finally { setChatSending(false); }
  }

  function toggleChat(bookingId: number) {
    if (openChatId === bookingId) {
      setOpenChatId(null);
    } else {
      setOpenChatId(bookingId);
      setChatResetKey(k => k + 1);
    }
  }

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [promoteListing, setPromoteListing] = useState<{ id: number; title: string } | null>(null);

  // Unread notifications state for sidebar badges
  const [unreadNotifs, setUnreadNotifs] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/auth");
  }, [isAuthenticated, setLocation]);

  const API_NOTIF_BASE = import.meta.env.VITE_API_URL ?? "";

  useEffect(() => {
    if (!token) return;
    fetch(`${API_NOTIF_BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: AppNotification[]) => setUnreadNotifs(data.filter(n => !n.isRead)))
      .catch(() => {});
  }, [token]);

  const markSectionRead = useCallback(async (types: string[]) => {
    if (!token) return;
    const toMark = unreadNotifs.filter(n => types.includes(n.type));
    if (toMark.length === 0) return;
    setUnreadNotifs(prev => prev.filter(n => !types.includes(n.type)));
    for (const n of toMark) {
      fetch(`${API_NOTIF_BASE}/api/notifications/${n.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [token, unreadNotifs]);

  const REMINDER_TYPES_LIST = [
    "reminder_confirm_pending",
    "reminder_handover_today",
    "reminder_handover_overdue",
    "reminder_return_today",
    "reminder_return_overdue",
    "reminder_return_confirm",
    // System auto-transition notifications
    "auto_cancelled",
    "auto_activated",
  ];

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "incoming") markSectionRead(["booking_created", "booking_cancelled", "booking_return_pending", ...REMINDER_TYPES_LIST]);
    if (tab === "outgoing") markSectionRead(["booking_submitted", "booking_confirmed", "booking_rejected", "booking_active", ...REMINDER_TYPES_LIST]);
    if (tab === "history")  markSectionRead(["booking_completed", "auto_completed"]);
  }, [markSectionRead]);

  // Mark initial tab notifications as read on first load (excludes reminders — only cleared on explicit tab click)
  useEffect(() => {
    if (!token || unreadNotifs.length === 0) return;
    if (activeTab === "incoming") markSectionRead(["booking_created", "booking_cancelled", "booking_return_pending"]);
    else if (activeTab === "outgoing") markSectionRead(["booking_submitted", "booking_confirmed", "booking_rejected", "booking_active"]);
    else if (activeTab === "history") markSectionRead(["booking_completed", "auto_completed"]);
  }, [token, unreadNotifs.length > 0]);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const { data: user, isLoading: userLoading } = useGetCurrentUser(
    { request: authHeaders },
    { query: { enabled: !!token } }
  );
  const { data: userProfile } = useGetUserById(
    user?.id || 0,
    { request: authHeaders },
    { query: { enabled: !!user } }
  );
  const { data: listings, isLoading: listingsLoading } = useGetUserListings(
    user?.id || 0,
    { request: authHeaders },
    { query: { enabled: !!user && user.role === "owner" } }
  );
  const { data: bookings, isLoading: bookingsLoading, refetch: refetchBookings } = useGetMyBookings(
    { request: authHeaders },
    { query: { enabled: !!token } }
  );
  const { data: regions } = useGetRegions();

  const updateStatus = useUpdateBookingStatus({ request: authHeaders });
  const updateProfile = useUpdateUserProfile({ request: authHeaders });
  const deleteListing = useDeleteListing({ request: authHeaders });
  const updateListing = useUpdateListing({ request: authHeaders });

  useEffect(() => {
    if (user && user.role === "renter" && activeTab === "incoming") {
      setActiveTab("outgoing");
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name,
        phone: user.phone || "",
        role: (user.role === "owner" ? "owner" : "renter") as "renter" | "owner",
        regionId: user.regionId ?? undefined,
        bio: user.bio || "",
        telegram: user.telegram || "",
        website: user.website || "",
      });
    }
  }, [user?.id]);

  // Stage 38: load Telegram linking status
  useEffect(() => {
    if (!user || !token) return;
    fetch("/api/telegram/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setTgLinked(d.linked ?? false);
        if (d.preferences) setTgPrefs(d.preferences);
        if (d.botUsername) setTgBotUsername(d.botUsername);
      })
      .catch(() => {});
  }, [user?.id, token]);

  // Stage 38: auto-poll linking status every 3s while OTP is shown
  useEffect(() => {
    if (!tgOtp || tgLinked || !token) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/telegram/status", { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.linked) { setTgLinked(true); setTgOtp(null); }
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [!!tgOtp, tgLinked, token]);

  // Stage 38-UE: load phone verification status
  useEffect(() => {
    if (!user || !token) return;
    fetch("/api/sms/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setPhoneVerified(d.phoneVerified ?? false);
        setSmsEnabled(d.smsEnabled ?? false);
        if (d.hasOtp) {
          setPhoneOtpSent(true);
          setPhoneOtpExpiresAt(d.otpExpiresAt ?? null);
        }
      })
      .catch(() => {});
  }, [user?.id, token]);

  const tgGenerateOtp = async () => {
    if (!token) return;
    setTgBusy(true);
    try {
      const r = await fetch("/api/telegram/generate-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setTgOtp({ otp: d.otp, expiresAt: d.expiresAt });
    } catch {}
    setTgBusy(false);
  };

  const tgUnlink = async () => {
    if (!token) return;
    setTgBusy(true);
    try {
      await fetch("/api/telegram/unlink", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTgLinked(false);
      setTgOtp(null);
      toast({ title: "Telegram отвязан" });
    } catch {}
    setTgBusy(false);
  };

  const tgUpdatePref = async (key: "bookings" | "system" | "chats", val: boolean) => {
    if (!token) return;
    const next = { ...tgPrefs, [key]: val };
    setTgPrefs(next);
    fetch("/api/telegram/preferences", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    }).catch(() => setTgPrefs(tgPrefs));
  };

  // Stage 38-UE: phone OTP handlers
  const sendPhoneOtp = async () => {
    if (!token) return;
    setPhoneOtpBusy(true);
    try {
      const r = await fetch("/api/sms/send-phone-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || d.error || "Ошибка отправки");
      setPhoneOtpSent(true);
      setPhoneOtpExpiresAt(d.expiresAt ?? null);
      toast({ title: "SMS отправлен", description: `Код отправлен на ${d.maskedPhone ?? "ваш номер"}` });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setPhoneOtpBusy(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!token || !phoneOtpInput.trim()) return;
    setPhoneOtpBusy(true);
    try {
      const r = await fetch("/api/sms/verify-phone-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ otp: phoneOtpInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || d.error || "Неверный код");
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneOtpInput("");
      toast({ title: "Телефон верифицирован!", description: "Теперь вы будете получать SMS-уведомления" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setPhoneOtpBusy(false);
    }
  };

  // Stage 20a — подгружаем открытую заявку на верификацию (для кнопки «Отозвать»).
  // Только для владельцев, у которых ещё нет бейджа.
  // code-review fix: добавлен user?.role в deps — на случай смены роли в сессии.
  useEffect(() => {
    if (!token) return;
    if (!user || user.role !== "owner" || (user as any).isVerified) {
      setVerifPendingTicketId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL ?? "";
        const r = await fetch(`${API_BASE}/api/support/tickets`, { headers: { ...authHeaders.headers } });
        if (!r.ok) return;
        const tickets: Array<{ id: number; category: string; status: string }> = await r.json();
        if (cancelled) return;
        const pending = tickets.find(t => t.category === "verification_request" && (t.status === "open" || t.status === "in_progress"));
        setVerifPendingTicketId(pending ? pending.id : null);
      } catch {/* silent */}
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, (user as any)?.isVerified, token]);

  if (userLoading) return (
    <Layout>
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    </Layout>
  );
  if (!user) return null;

  const incomingBookings = bookings?.filter(b => b.ownerId === user.id) || [];
  const outgoingBookings = bookings?.filter(b => b.renterId === user.id) || [];

  // All completed deals: as owner (earned) + as renter (spent), deduped
  type DealEntry = { booking: typeof incomingBookings[0]; dealRole: "owner" | "renter" };
  const completedDeals: DealEntry[] = [
    ...incomingBookings.filter(b => b.status === "completed").map(b => ({ booking: b, dealRole: "owner" as const })),
    ...outgoingBookings.filter(b => b.status === "completed").map(b => ({ booking: b, dealRole: "renter" as const })),
  ].sort((a, b) => new Date(b.booking.createdAt).getTime() - new Date(a.booking.createdAt).getTime());

  // Заработок владельца = фактическая стоимость аренды (rentAmount), только безопасные сделки
  // Прямой расчёт (150₽) — это доход платформы, не владельца
  const totalEarned = completedDeals
    .filter(d => d.dealRole === "owner" && (d.booking as any).protectionEnabled !== false)
    .reduce((s, d) => s + ((d.booking as any).rentAmount ?? d.booking.totalPrice), 0);
  const totalSpent  = completedDeals.filter(d => d.dealRole === "renter").reduce((s, d) => s + d.booking.totalPrice, 0);
  const totalRentalDays = completedDeals.filter(d => d.dealRole === "renter").reduce((s, d) => s + (d.booking.totalDays || 0), 0);
  const rentalCount = completedDeals.filter(d => d.dealRole === "renter").length;
  const AVG_ITEM_BUY_PRICE = 5000;
  const AVG_CO2_PER_ITEM_KG = 12;
  const savingsVsBuying = Math.max(0, AVG_ITEM_BUY_PRICE * rentalCount - totalSpent);
  const co2SavedKg = AVG_CO2_PER_ITEM_KG * rentalCount;
  const co2Label = co2SavedKg >= 1000
    ? `~${(co2SavedKg / 1000).toFixed(1).replace(".", ",")} т`
    : `~${co2SavedKg} кг`;

  const statusOrder: Record<string, number> = {
    pending: 0, confirmed: 1, active: 2, return_pending: 3, completed: 4, rejected: 5, cancelled: 6,
  };

  const filteredIncoming = (() => {
    const base = incomingFilter === "all"
      ? incomingBookings
      : incomingBookings.filter(b => b.status === incomingFilter);
    return [...base].sort((a, b) => {
      if (incomingSort === "pending_first") {
        const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        return sd !== 0 ? sd : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (incomingSort === "start_asc")
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (incomingSort === "price_desc")
        return b.totalPrice - a.totalPrice;
      // newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  const filteredOutgoing = (() => {
    const base = outgoingFilter === "all"
      ? outgoingBookings
      : outgoingBookings.filter(b => b.status === outgoingFilter);
    return [...base].sort((a, b) => {
      if (outgoingSort === "active_first") {
        const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        return sd !== 0 ? sd : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (outgoingSort === "start_asc")
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (outgoingSort === "price_desc")
        return b.totalPrice - a.totalPrice;
      // newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  const activeListings = listings?.filter(l => l.isAvailable) || [];
  const hiddenListings = listings?.filter(l => !l.isAvailable) || [];
  const filteredListings = listingFilter === "active" ? activeListings
    : listingFilter === "hidden" ? hiddenListings
    : (listings || []);

  const pendingIncoming  = incomingBookings.filter(b => b.status === "pending").length;
  const pendingOutgoing  = outgoingBookings.filter(b => b.status === "pending").length;
  const activeIncoming   = incomingBookings.filter(b => ["confirmed","active"].includes(b.status)).length;
  const activeOutgoing   = outgoingBookings.filter(b => ["confirmed","active"].includes(b.status)).length;
  const completedIncoming = incomingBookings.filter(b => b.status === "completed").length;

  // Per-section unread notification counts for sidebar badges
  const REMINDER_TYPES = [
    "reminder_confirm_pending",
    "reminder_handover_today",
    "reminder_handover_overdue",
    "reminder_return_today",
    "reminder_return_overdue",
    "reminder_return_confirm",
    // System auto-transition notifications (go to both tabs)
    "auto_cancelled",
    "auto_activated",
  ];
  const badgeIncoming = unreadNotifs.filter(n =>
    ["booking_created", "booking_cancelled", "booking_return_pending", ...REMINDER_TYPES].includes(n.type)
  ).length;
  const badgeOutgoing = unreadNotifs.filter(n =>
    ["booking_submitted", "booking_confirmed", "booking_rejected", "booking_active", ...REMINDER_TYPES].includes(n.type)
  ).length;
  const badgeHistory  = unreadNotifs.filter(n =>
    n.type === "booking_completed" || n.type === "auto_completed"
  ).length;

  async function handleStatusChange(bookingId: number, status: "confirmed" | "active" | "return_pending" | "rejected" | "completed" | "cancelled", ownerComment?: string) {
    setUpdatingId(bookingId);
    try {
      await updateStatus.mutateAsync({
        id: bookingId,
        data: { status, ...(ownerComment !== undefined && { ownerComment }) },
      });
      await refetchBookings();
    } catch (e: any) {
      // Stage 22a (hardened post-review) — клиент кидает ApiError с .status и .data.
      // Перехватываем 409 digital_act_required и сразу открываем модалку загрузки.
      const status = e?.status ?? e?.response?.status;
      const data = e?.data ?? e?.response?.data ?? e?.body;
      const code = data?.error;
      const msg = data?.message ?? e?.message;
      if (status === 409 && code === "digital_act_required") {
        toast({
          title: "Нужен Цифровой акт приёмки",
          description: "Загрузите минимум 4 фото вещи перед передачей.",
          variant: "destructive",
        });
        setDigitalActModal({ bookingId, type: "check_in" });
      } else {
        toast({ title: "Не удалось изменить статус", description: msg ?? "Ошибка сервера", variant: "destructive" });
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectModal) return;
    await handleStatusChange(rejectModal.bookingId, "rejected", rejectComment);
    setRejectModal(null);
    setRejectComment("");
  }

  // ── Date guards: intercept premature / risky status changes ───────────────
  function handleGuardedAction(
    booking: NonNullable<typeof bookings>[0],
    status: "confirmed" | "active" | "return_pending" | "rejected" | "completed" | "cancelled",
    role: "owner" | "renter",
  ) {
    const today = new Date().toISOString().slice(0, 10);

    // Guard 1: Owner clicking "Передать вещь" before the start date
    if (status === "active" && role === "owner" && booking.startDate > today) {
      setGuardModal({ type: "early_handover", booking });
      setRescheduleStart(booking.startDate);
      setRescheduleEnd(booking.endDate);
      return;
    }

    // Guard 2: Renter clicking "Возвращаю вещь" before the end date
    if (status === "return_pending" && role === "renter" && booking.endDate > today) {
      setGuardModal({ type: "early_return", booking });
      return;
    }

    // Guard 3: Any cancellation — always confirm with context
    if (status === "cancelled") {
      setGuardModal({ type: "cancel_confirm", booking, cancellerRole: role });
      return;
    }

    handleStatusChange(booking.id, status);
  }

  async function handleRescheduleSubmit() {
    if (!guardModal) return;
    const today = new Date().toISOString().slice(0, 10);
    if (!rescheduleStart || !rescheduleEnd) { setRescheduleErr("Заполните обе даты"); return; }
    if (rescheduleStart < today)  { setRescheduleErr("Дата начала не может быть в прошлом"); return; }
    if (rescheduleEnd <= rescheduleStart) { setRescheduleErr("Дата окончания должна быть позже начала"); return; }

    setRescheduleSubmitting(true);
    setRescheduleErr("");
    try {
      const resp = await fetch(`${DASHBOARD_API}/api/bookings/${guardModal.booking.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startDate: rescheduleStart, endDate: rescheduleEnd }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setRescheduleErr((err as any).message ?? "Ошибка сохранения дат");
        return;
      }
      await refetchBookings();
      closeGuard();
    } catch {
      setRescheduleErr("Ошибка соединения");
    } finally {
      setRescheduleSubmitting(false);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  async function handleDeleteListing(id: number) {
    setDeletingId(id);
    try {
      await deleteListing.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user!.id}/listings`] });
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleVisibility(id: number, currentValue: boolean) {
    setTogglingId(id);
    try {
      await updateListing.mutateAsync({ id, data: { isAvailable: !currentValue } as any });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user!.id}/listings`] });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({ id: user!.id, data: profileForm });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function handleCredentialsSave(e: React.FormEvent) {
    e.preventDefault();
    setCredError("");
    const { newEmail, currentPassword, newPassword, confirmPassword } = credForm;
    if (!currentPassword) { setCredError("Введите текущий пароль"); return; }
    if (!newEmail && !newPassword) { setCredError("Укажите новый email или пароль"); return; }
    if (newPassword && newPassword !== confirmPassword) { setCredError("Пароли не совпадают"); return; }
    if (newPassword && newPassword.length < 6) { setCredError("Пароль должен быть не менее 6 символов"); return; }
    setCredPending(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_BASE}/api/users/${user!.id}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          currentPassword,
          ...(newEmail ? { newEmail } : {}),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCredError(data.message ?? "Ошибка"); return; }
      setCredForm({ newEmail: "", currentPassword: "", newPassword: "", confirmPassword: "" });
      setCredSaved(true);
      setTimeout(() => setCredSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      setCredError("Ошибка соединения");
    } finally {
      setCredPending(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const API_BASE = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_BASE}/api/users/${user!.id}/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "УДАЛИТЬ") return;
    setDeletingAccount(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Ошибка", description: data.message ?? "Не удалось удалить аккаунт", variant: "destructive" });
        return;
      }
      removeToken();
      toast({ title: "Аккаунт удалён", description: "Ваши данные анонимизированы. До свидания!" });
      setShowDeleteAccountModal(false);
      setLocation("/");
    } catch {
      toast({ title: "Ошибка соединения", variant: "destructive" });
    } finally {
      setDeletingAccount(false);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    pending:        { label: "Ожидает",           color: "bg-amber-100 text-amber-800 border-amber-200",     dot: "bg-amber-400" },
    confirmed:      { label: "Подтверждена",      color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
    active:         { label: "Активная аренда",   color: "bg-teal-100 text-teal-800 border-teal-200",        dot: "bg-teal-500" },
    return_pending: { label: "Возврат вещи",      color: "bg-violet-100 text-violet-800 border-violet-200",  dot: "bg-violet-500" },
    completed:      { label: "Завершена",          color: "bg-blue-100 text-blue-800 border-blue-200",        dot: "bg-blue-400" },
    rejected:       { label: "Отклонена",          color: "bg-red-100 text-red-800 border-red-200",           dot: "bg-red-400" },
    cancelled:      { label: "Отменена",           color: "bg-gray-100 text-gray-600 border-gray-200",        dot: "bg-gray-400" },
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  const statusFilters: { value: BookingStatusFilter; label: string }[] = [
    { value: "all",            label: "Все" },
    { value: "pending",        label: "Ожидают" },
    { value: "confirmed",      label: "Подтверждены" },
    { value: "active",         label: "Активные" },
    { value: "return_pending", label: "Возврат" },
    { value: "completed",      label: "Завершены" },
    { value: "rejected",       label: "Отклонены" },
    { value: "cancelled",      label: "Отменены" },
  ];

  function countByStatus(arr: typeof incomingBookings, status: BookingStatusFilter) {
    return status === "all" ? arr.length : arr.filter(b => b.status === status).length;
  }

  const StatusFilterBar = ({
    items,
    value,
    onChange,
  }: {
    items: typeof incomingBookings;
    value: BookingStatusFilter;
    onChange: (v: BookingStatusFilter) => void;
  }) => (
    <div className="flex gap-2 flex-wrap">
      {statusFilters.map(f => {
        const count = countByStatus(items, f.value);
        if (f.value !== "all" && count === 0) return null;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              value === f.value
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
            }`}
          >
            {f.label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                value === f.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Contextual hints with visual deadline timers ──────────────────────────
  const AutoHint = ({ booking, role }: { booking: (typeof bookings)[0]; role: "owner" | "renter" }) => {
    const now = Date.now();

    const Note = ({ urgent, children }: { urgent?: boolean; children: ReactNode }) => (
      <div className={`flex items-start gap-1.5 text-xs leading-relaxed ${
        urgent ? "text-amber-700" : "text-slate-500"
      }`}>
        <span className="shrink-0 mt-0.5">🤖</span>
        <span>{children}</span>
      </div>
    );

    // ── pending ──
    if (booking.status === "pending") {
      const deadline = new Date(booking.createdAt).getTime() + 72 * 3_600_000;
      const urgent = deadline - now < 12 * 3_600_000 && deadline > now;
      return (
        <div className="flex flex-col gap-1.5">
          <DeadlineTimer
            deadlineMs={deadline}
            totalMs={72 * 3_600_000}
            label={role === "owner" ? "До авто-отмены заявки" : "Ожидание ответа владельца"}
          />
          {role === "owner" ? (
            <Note urgent={urgent}>
              {urgent ? "⚠️ Срочно ответьте!" : "Ответьте на заявку"} — иначе через 72 ч после подачи она будет <strong>автоматически отменена</strong>.
            </Note>
          ) : (
            <Note>Если владелец не ответит в срок — заявка отменится автоматически.</Note>
          )}
        </div>
      );
    }

    // ── confirmed ──
    if (booking.status === "confirmed") {
      const startMs  = new Date(booking.startDate).getTime();
      const autoMs   = startMs + 48 * 3_600_000;
      const overdue  = now > startMs;
      if (!overdue) {
        return (
          <div className="flex flex-col gap-1.5">
            <DeadlineTimer deadlineMs={startMs} totalMs={7 * 86_400_000} label="До начала аренды" />
            {role === "owner" ? (
              <Note>В день начала ({booking.startDate}) нажмите «Передать вещь». Если вещь не передана в течение 48 ч после даты начала — бронирование будет <strong>автоматически отменено</strong>.</Note>
            ) : (
              <Note>Встретьтесь с владельцем {booking.startDate} для получения вещи. Если передача не произойдёт в течение 48 ч после даты начала — бронирование будет <strong>автоматически отменено</strong>.</Note>
            )}
          </div>
        );
      } else {
        const urgent = autoMs - now < 12 * 3_600_000 && autoMs > now;
        return (
          <div className="flex flex-col gap-1.5">
            <DeadlineTimer deadlineMs={autoMs} totalMs={48 * 3_600_000} label="До авто-отмены" />
            {role === "owner" ? (
              <Note urgent>⚠️ Дата начала прошла. Подтвердите передачу вещи — иначе бронирование будет <strong>автоматически отменено</strong>.</Note>
            ) : (
              <Note urgent={urgent}>
                {urgent && "⚠️ "}Дата начала ({booking.startDate}) прошла. Если владелец не передаст вещь — бронирование будет <strong>автоматически отменено</strong>.
              </Note>
            )}
          </div>
        );
      }
    }

    // ── active ──
    if (booking.status === "active") {
      const startMs = new Date(booking.startDate).getTime();
      const endMs   = new Date(booking.endDate).getTime();
      const autoMs  = endMs + 7 * 86_400_000;
      const overdue = now > endMs;
      const rentalDuration = Math.max(endMs - startMs, 86_400_000);
      if (!overdue) {
        return (
          <div className="flex flex-col gap-1.5">
            <DeadlineTimer deadlineMs={endMs} totalMs={rentalDuration} label="До конца аренды" />
            {role === "renter" ? (
              <Note>Верните вещь до <strong>{booking.endDate}</strong> и нажмите «Возвращаю вещь».</Note>
            ) : (
              <Note>Арендатор вернёт вещь до {booking.endDate}. Вы получите уведомление о возврате.</Note>
            )}
          </div>
        );
      } else {
        const urgent = autoMs - now < 12 * 3_600_000 && autoMs > now;
        return (
          <div className="flex flex-col gap-1.5">
            <DeadlineTimer deadlineMs={autoMs} totalMs={7 * 86_400_000} label="До авто-завершения сделки" />
            {role === "renter" ? (
              <Note urgent>⚠️ Срок аренды истёк. Верните вещь и нажмите «Возвращаю вещь» как можно скорее.</Note>
            ) : (
              <Note urgent={urgent}>{urgent && "⚠️ "}Срок аренды истёк. Проверьте, вернул ли арендатор вещь.</Note>
            )}
          </div>
        );
      }
    }

    // ── return_pending — no exact timestamp, show pulsing wait indicator ──
    if (booking.status === "return_pending") {
      const isOwner = role === "owner";
      return (
        <div className="flex flex-col gap-1.5">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isOwner ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
              isOwner ? "bg-amber-400" : "bg-slate-400"
            }`} />
            <span className="text-[11px] text-muted-foreground flex-1">
              {isOwner ? "До авто-завершения" : "Ожидание подтверждения"}
            </span>
            <span className={`text-xs font-semibold ${isOwner ? "text-amber-600" : "text-slate-500"}`}>
              ≤ 72 ч
            </span>
          </div>
          {isOwner ? (
            <Note urgent>⚠️ Нажмите «Принять возврат» — иначе сделка завершится автоматически через 72 ч.</Note>
          ) : (
            <Note>Владелец должен подтвердить возврат в течение 72 ч — иначе сделка завершится автоматически.</Note>
          )}
        </div>
      );
    }

    return null;
  };
  // ─────────────────────────────────────────────────────────────────────────

  const BookingCard = ({ booking, role }: { booking: (typeof bookings)[0]; role: "owner" | "renter" }) => {
    const isUpdating = updatingId === booking.id;
    const API_BASE = import.meta.env.VITE_API_URL ?? "";
    const photoSrc = booking.listingPhoto
      ? (booking.listingPhoto.startsWith("http") ? booking.listingPhoto : `${API_BASE}${booking.listingPhoto}`)
      : "https://images.unsplash.com/photo-1581515320577-49520422c5cd?w=200";

    const unread = unreadCounts[booking.id] ?? 0;
    const isChatOpen = openChatId === booking.id;

    return (
      <>
      <div className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-48 h-44 sm:h-auto bg-muted shrink-0 overflow-hidden">
            <img src={photoSrc} className="w-full h-full object-cover" alt={booking.listingTitle || ""} />
          </div>
          <div className="flex-grow p-4 flex flex-col gap-3 min-w-0">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <Link href={`/listings/${booking.listingId}`}
                className="font-bold text-base hover:text-primary transition-colors leading-tight">
                {booking.listingTitle}
              </Link>
              <StatusBadge status={booking.status} />
            </div>

            {booking.bookingNumber && (
              <div className="flex items-center gap-2 -mt-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/50 rounded-lg px-2.5 py-1 font-mono tracking-wide">
                  <span className="text-[10px] text-muted-foreground/70 font-sans">№</span>
                  {booking.bookingNumber}
                </span>
                <button
                  title="Скопировать номер бронирования"
                  onClick={() => {
                    navigator.clipboard.writeText(booking.bookingNumber!);
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Период</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  {format(new Date(booking.startDate), "dd.MM")} — {format(new Date(booking.endDate), "dd.MM.yy")}
                </p>
                <p className="text-xs text-muted-foreground">{booking.totalDays} {booking.totalDays === 1 ? "сутки" : "суток"}</p>
              </div>
              <div>
                {role === "owner" ? (() => {
                  const isDirect = (booking as any).protectionEnabled === false;
                  const rentAmount = (booking as any).rentAmount as number | undefined;
                  const ownerPayout = (booking as any).ownerPayout as number | undefined;
                  // Сколько владелец фактически получит:
                  //  • прямой контактный расчёт — арендатор платит наличными за всю аренду
                  //  • защищённая сделка — выплата от платформы после удержания комиссии
                  const profit = isDirect
                    ? rentAmount
                    : (ownerPayout ?? rentAmount ?? booking.totalPrice);
                  return (
                    <>
                      <p className="text-muted-foreground text-xs mb-0.5">Ваш доход</p>
                      <p className="font-bold text-green-700 text-base">
                        {profit != null ? formatPrice(profit) : "по договорённости"}
                      </p>
                      {isDirect ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          наличными от арендатора
                          {Number(booking.totalPrice) > 0 && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              (платформе оплачено {formatPrice(booking.totalPrice)} за контакт)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          поступит на карту после возврата
                        </p>
                      )}
                      {booking.listingDeposit != null && booking.listingDeposit > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          + залог <span className="font-semibold text-foreground">{formatPrice(booking.listingDeposit)}</span>
                        </p>
                      )}
                    </>
                  );
                })() : (() => {
                  const isDirect = (booking as any).protectionEnabled === false;
                  const rentAmount = (booking as any).rentAmount as number | undefined;
                  if (isDirect) {
                    // Прямой расчёт: арендатор уже заплатил платформе за контакт,
                    // а владельцу отдаст наличными за всю аренду.
                    return (
                      <>
                        <p className="text-muted-foreground text-xs mb-0.5">Аренда владельцу</p>
                        <p className="font-bold text-primary text-base">
                          {rentAmount != null ? formatPrice(rentAmount) : "по договорённости"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          наличными при встрече
                          {Number(booking.totalPrice) > 0 && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              (платформе оплачено {formatPrice(booking.totalPrice)} за контакт)
                            </span>
                          )}
                        </p>
                        {booking.listingDeposit != null && booking.listingDeposit > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            + залог <span className="font-semibold text-foreground">{formatPrice(booking.listingDeposit)}</span>
                          </p>
                        )}
                      </>
                    );
                  }
                  return (
                    <>
                      <p className="text-muted-foreground text-xs mb-0.5">Сумма</p>
                      <p className="font-bold text-primary text-base">{formatPrice(booking.totalPrice)}</p>
                      {booking.listingDeposit != null && booking.listingDeposit > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          + залог <span className="font-semibold text-foreground">{formatPrice(booking.listingDeposit)}</span>
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-muted-foreground text-xs mb-1">
                  {role === "owner" ? "Арендатор" : "Владелец"}
                </p>
                {role === "owner" ? (
                  <Link href={`/users/${booking.renterId}`}
                    className="inline-flex items-center gap-2 group/chip hover:bg-muted rounded-xl px-2 py-1 -mx-2 -my-1 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground overflow-hidden shrink-0">
                      {booking.renterAvatar ? (
                        <img
                          src={booking.renterAvatar.startsWith("http") ? booking.renterAvatar : `${API_BASE}${booking.renterAvatar}`}
                          alt={booking.renterName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        booking.renterName?.charAt(0).toUpperCase() || <User className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-sm truncate group-hover/chip:text-primary transition-colors">
                        {booking.renterName || "Арендатор"}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Смотреть профиль →</p>
                    </div>
                  </Link>
                ) : (
                  <div>
                    <Link href={`/users/${booking.ownerId}`}
                      className="font-semibold text-sm hover:text-primary transition-colors">
                      {booking.ownerName || "Владелец"}
                    </Link>
                    {(["confirmed", "active", "return_pending", "completed"].includes(booking.status)) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {booking.ownerPhone && (
                          <a href={`tel:${booking.ownerPhone}`}
                            className="flex items-center gap-1 text-primary text-sm hover:underline">
                            <PhoneCall className="w-3 h-3" />{booking.ownerPhone}
                          </a>
                        )}
                        {booking.ownerTelegram && (
                          <a href={`https://t.me/${booking.ownerTelegram.replace(/^@/, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#1a8cbf] text-sm hover:underline">
                            <Send className="w-3 h-3" />@{booking.ownerTelegram.replace(/^@/, "")}
                          </a>
                        )}
                        {booking.ownerWebsite && (
                          <a href={booking.ownerWebsite.startsWith("http") ? booking.ownerWebsite : `https://${booking.ownerWebsite}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground text-sm hover:underline">
                            <Globe className="w-3 h-3" />{booking.ownerWebsite.replace(/^https?:\/\//, "").split("/")[0]}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {role === "renter" && (booking as any).listingMeetingAddress && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Место передачи вещи</p>
                  <p className="text-sm text-amber-900">{(booking as any).listingMeetingAddress}</p>
                </div>
              </div>
            )}

            {booking.message && (
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 italic border-l-2 border-border">
                «{booking.message}»
              </p>
            )}

            {booking.status === "rejected" && booking.ownerComment && (
              <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Причина: </span>{booking.ownerComment}
                </p>
              </div>
            )}

            {booking.status === "pending" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                {role === "owner" && (
                  <>
                    <button onClick={() => handleStatusChange(booking.id, "confirmed")} disabled={isUpdating}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Подтвердить
                    </button>
                    <button onClick={() => { setRejectComment(""); setRejectModal({ bookingId: booking.id }); }} disabled={isUpdating}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                      <XCircle className="w-4 h-4" />
                      Отклонить
                    </button>
                  </>
                )}
                {role === "renter" && (
                  <button onClick={() => handleGuardedAction(booking, "cancelled", "renter")} disabled={isUpdating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Отменить заявку
                  </button>
                )}
              </div>
            )}

            {booking.status === "confirmed" && role === "owner" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                {/* Stage 22a — Цифровой акт приёмки. Backend блокирует переход active без него. */}
                <button onClick={() => setDigitalActModal({ bookingId: booking.id, type: "check_in" })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-semibold rounded-xl transition-colors">
                  <ShieldCheck className="w-4 h-4" />
                  Цифровой акт приёмки
                </button>
                <button onClick={() => handleGuardedAction(booking, "active", "owner")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Передать вещь арендатору
                </button>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "owner")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить сделку
                </button>
              </div>
            )}

            {booking.status === "confirmed" && role === "renter" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                  <Clock className="w-4 h-4 shrink-0" />
                  Ожидайте: владелец подтвердит передачу вещи
                </div>
                {/* Stage 22a — арендатор тоже может подгрузить свой Check-in акт. */}
                <button onClick={() => setDigitalActModal({ bookingId: booking.id, type: "check_in" })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-semibold rounded-xl transition-colors">
                  <ShieldCheck className="w-4 h-4" />
                  Цифровой акт приёмки
                </button>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "renter")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              </div>
            )}

            {booking.status === "active" && role === "renter" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-500" />
                  Аренда идёт
                </div>
                {/* Stage 22a — Check-out акт перед возвратом. */}
                <button onClick={() => setDigitalActModal({ bookingId: booking.id, type: "check_out" })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-semibold rounded-xl transition-colors">
                  <ShieldCheck className="w-4 h-4" />
                  Цифровой акт возврата
                </button>
                <button onClick={() => handleGuardedAction(booking, "return_pending", "renter")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                  Возвращаю вещь
                </button>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "renter")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              </div>
            )}

            {booking.status === "active" && role === "owner" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
                  <Clock className="w-4 h-4 shrink-0" />
                  Вещь у арендатора — аренда активна
                </div>
                <button onClick={() => setDigitalActModal({ bookingId: booking.id, type: "check_out" })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-semibold rounded-xl transition-colors">
                  <ShieldCheck className="w-4 h-4" />
                  Цифровой акт возврата
                </button>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "owner")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить аренду
                </button>
              </div>
            )}

            {booking.status === "return_pending" && role === "owner" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700">
                  <ArrowDownCircle className="w-4 h-4 shrink-0" />
                  Арендатор возвращает вещь
                </div>
                <button onClick={() => handleStatusChange(booking.id, "completed")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Принять возврат — завершить сделку
                </button>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "owner")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              </div>
            )}

            {booking.status === "return_pending" && role === "renter" && (
              <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700">
                  <Clock className="w-4 h-4 shrink-0" />
                  Ожидаем подтверждения возврата от владельца
                </div>
                <button onClick={() => handleGuardedAction(booking, "cancelled", "renter")} disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              </div>
            )}

            {["pending", "confirmed", "active", "return_pending"].includes(booking.status) && (
              <AutoHint booking={booking} role={role} />
            )}

            {booking.status === "completed" && !reviewedIds.has(booking.id) && (
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => handleOpenReview(booking, role)}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors ${role === "renter" ? "text-amber-700 hover:text-amber-800" : "text-blue-700 hover:text-blue-800"}`}
                  title="Только проверенные отзывы. Доступно после завершённой сделки через платформу."
                >
                  <Star className="w-4 h-4 fill-current" />
                  {role === "renter" ? "Оцените сделку — оставьте отзыв о вещи и владельце" : "Оцените сделку — оставьте отзыв об арендаторе"}
                </button>
              </div>
            )}
            {booking.status === "completed" && reviewedIds.has(booking.id) && (
              <div className="pt-2 border-t border-border flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Отзыв оставлен — спасибо!
              </div>
            )}

            {/* ── Chat toggle button ─────────────────────────────────── */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => toggleChat(booking.id)}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${isChatOpen ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <MessageSquare className="w-4 h-4" />
                Чат с {role === "owner" ? "арендатором" : "владельцем"}
                {unread > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                    {unread}
                  </span>
                )}
                {/* Stage 34: WS connection indicator */}
                <span
                  title={isConnected ? "Чат подключён" : "Переподключение..."}
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? "bg-emerald-500" : "bg-amber-400"}`}
                />
                <span className="text-xs text-muted-foreground ml-auto">{isChatOpen ? "▲" : "▼"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      {isChatOpen && (
        <div id={`chat-panel-${booking.id}`} className="border border-border border-t-0 rounded-b-2xl bg-[#F8F5ED] -mt-px">
          <div className="p-3 sm:p-4">
            {/* Messages list */}
            <div className="flex flex-col gap-2 h-60 overflow-y-auto pr-1 mb-3 scroll-smooth" id={`chat-${booking.id}`}>
              {!(chatMessages[booking.id]?.length) ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground text-center">
                    Здесь пока нет сообщений.<br />
                    Напишите {role === "owner" ? "арендатору" : "владельцу"}!
                  </p>
                </div>
              ) : (
                (chatMessages[booking.id] ?? []).map((msg) => {
                  const isSelf = msg.senderId === user.id;
                  const time = new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isSelf
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-white text-foreground rounded-bl-sm border border-border"
                      }`}>
                        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-0.5 ${isSelf ? "text-white/60 text-right" : "text-muted-foreground"}`}>{time}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Input row — isolated component to prevent Dashboard re-render on each keystroke */}
            <ChatInputRow
              onSend={(content) => sendChatMessage(booking.id, content)}
              chatSending={chatSending}
              resetKey={chatResetKey}
            />
          </div>
        </div>
      )}
      </>
    );
  };

  const navItems = [
    ...(user.role === "owner" ? [
      { id: "incoming" as const, label: "Входящие заявки", icon: ArrowDownCircle, badge: badgeIncoming },
    ] : []),
    { id: "outgoing" as const, label: "Мои бронирования", icon: ArrowUpCircle, badge: badgeOutgoing },
    ...(user.role === "owner" ? [
      { id: "listings" as const, label: "Мои объявления", icon: LayoutGrid, badge: 0 },
    ] : []),
    { id: "history" as const, label: "История сделок", icon: BadgeCheck, badge: badgeHistory },
    // В Бета-режиме скрываем «Финансы» (выплаты/комиссии) и «Баланс контактов»
    // (платный доступ) — функциональности в beta нет.
    ...(isCommercialMode ? [
      { id: "wallet" as const, label: "Кошелёк", icon: Wallet, badge: 0 },
      { id: "finance" as const, label: "Финансы", icon: Coins, badge: 0 },
      { id: "contacts" as const, label: "Баланс контактов", icon: Wallet, badge: 0 },
    ] : []),
    { id: "support" as const, label: "Поддержка", icon: LifeBuoy, badge: 0 },
    { id: "profile" as const, label: "Настройки", icon: Settings, badge: 0 },
  ];

  return (
    <Layout>
      {/* ── Profile header ── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0 pb-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
                {user.avatar
                  ? <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
                  : user.name.charAt(0).toUpperCase()}
              </div>
              {!!userProfile && (
                (userProfile.reviewCount ?? 0) > 0 ? (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 bg-amber-400 rounded-full shadow-md text-[10px] font-bold text-white whitespace-nowrap z-10">
                    <Star className="w-2.5 h-2.5 fill-white text-white" />
                    <span>{userProfile.rating?.toFixed(1)}</span>
                  </div>
                ) : (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 bg-white border border-border rounded-full shadow-sm text-[10px] text-muted-foreground whitespace-nowrap z-10">
                    <Star className="w-2.5 h-2.5 text-muted-foreground/30" />
                    <span>—</span>
                  </div>
                )
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{user.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {user.role === "owner" ? "Владелец" : "Арендатор"}
                {user.regionName ? ` • ${user.regionName}` : ""}
                {user.phone ? ` • ${user.phone}` : ""}
              </p>
            </div>

            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">

              {/* PRIMARY METRICS */}
              <div className="flex items-center gap-1.5">


                {/* Owner: новых заявок — urgent */}
                {pendingIncoming > 0 && (
                  <div className="text-center px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-bold text-amber-700 leading-none">{pendingIncoming}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">новых заявок</p>
                  </div>
                )}

                {/* Owner: объявлений */}
                {user.role === "owner" && (
                  <div className="text-center px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-sm font-bold text-primary leading-none">{activeListings.length}</p>
                    <p className="text-[10px] text-primary/60 mt-0.5">объявлений</p>
                  </div>
                )}

                {/* Owner: в аренде */}
                {user.role === "owner" && activeIncoming > 0 && (
                  <div className="text-center px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700 leading-none">{activeIncoming}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">в аренде</p>
                  </div>
                )}

                {/* Owner: завершено — show only on lg */}
                {user.role === "owner" && completedIncoming > 0 && (
                  <div className="hidden lg:block text-center px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-sm font-bold text-slate-600 leading-none">{completedIncoming}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">завершено</p>
                  </div>
                )}

                {/* Renter: ожидает ответа — urgent */}
                {user.role !== "owner" && pendingOutgoing > 0 && (
                  <div className="text-center px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-bold text-amber-700 leading-none">{pendingOutgoing}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">ожидает</p>
                  </div>
                )}

                {/* Renter: активных */}
                {user.role !== "owner" && activeOutgoing > 0 && (
                  <div className="text-center px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700 leading-none">{activeOutgoing}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">активных</p>
                  </div>
                )}

                {/* Renter: завершено — show only on lg */}
                {user.role !== "owner" && rentalCount > 0 && (
                  <div className="hidden lg:block text-center px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl">
                    <p className="text-sm font-bold text-teal-700 leading-none">{rentalCount}</p>
                    <p className="text-[10px] text-teal-600 mt-0.5">завершено</p>
                  </div>
                )}
              </div>

              {/* SEPARATOR */}
              {((user.role === "owner" && totalEarned > 0) ||
                (user.role !== "owner" && savingsVsBuying > 0)) && (
                <div className="w-px h-10 bg-border shrink-0" />
              )}

              {/* ACCENT: Owner — заработано */}
              {user.role === "owner" && totalEarned > 0 && (
                <div className="text-center px-3.5 py-2 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-300 rounded-xl shadow-sm">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-700 leading-none">{formatPrice(totalEarned)}</p>
                  </div>
                  <p className="text-[10px] text-emerald-600 font-medium">заработано</p>
                </div>
              )}

              {/* ACCENT: Renter — экономия + CO₂ */}
              {user.role !== "owner" && savingsVsBuying > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="text-center px-3.5 py-2 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <PiggyBank className="w-3 h-3 text-amber-600" />
                      <p className="text-sm font-bold text-amber-700 leading-none">~{formatPrice(savingsVsBuying)}</p>
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium">экономия</p>
                  </div>
                  {co2SavedKg > 0 && (
                    <div className="text-center px-3.5 py-2 bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-300 rounded-xl shadow-sm">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Wind className="w-3 h-3 text-teal-600" />
                        <p className="text-sm font-bold text-teal-700 leading-none">{co2Label}</p>
                      </div>
                      <p className="text-[10px] text-teal-600 font-medium">CO₂ сохранено</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* ── Mobile metrics row (hidden on md+) ── */}
          <div className="flex md:hidden flex-nowrap overflow-x-auto gap-2 mt-3 pb-1 -mx-1 px-1">

            {/* Owner chips */}
            {user.role === "owner" && (
              <>
                {pendingIncoming > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-bold text-amber-700 leading-none">{pendingIncoming}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">новых заявок</p>
                  </div>
                )}
                <div className="flex-none text-center px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-sm font-bold text-primary leading-none">{activeListings.length}</p>
                  <p className="text-[10px] text-primary/60 mt-0.5">объявлений</p>
                </div>
                {activeIncoming > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700 leading-none">{activeIncoming}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">в аренде</p>
                  </div>
                )}
                {completedIncoming > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-sm font-bold text-slate-600 leading-none">{completedIncoming}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">завершено</p>
                  </div>
                )}
                {totalEarned > 0 && (
                  <div className="flex-none text-center px-3 py-1.5 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-300 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      <p className="text-sm font-bold text-emerald-700 leading-none">{formatPrice(totalEarned)}</p>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-medium">заработано</p>
                  </div>
                )}
              </>
            )}

            {/* Renter chips */}
            {user.role !== "owner" && (
              <>
                {pendingOutgoing > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-bold text-amber-700 leading-none">{pendingOutgoing}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">ожидает</p>
                  </div>
                )}
                {activeOutgoing > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700 leading-none">{activeOutgoing}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">активных</p>
                  </div>
                )}
                {rentalCount > 0 && (
                  <div className="flex-none text-center px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl">
                    <p className="text-sm font-bold text-teal-700 leading-none">{rentalCount}</p>
                    <p className="text-[10px] text-teal-600 mt-0.5">завершено</p>
                  </div>
                )}
                {savingsVsBuying > 0 && (
                  <div className="flex-none text-center px-3 py-1.5 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <PiggyBank className="w-3 h-3 text-amber-600" />
                      <p className="text-sm font-bold text-amber-700 leading-none">~{formatPrice(savingsVsBuying)}</p>
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium">экономия</p>
                  </div>
                )}
                {co2SavedKg > 0 && (
                  <div className="flex-none text-center px-3 py-1.5 bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-300 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Wind className="w-3 h-3 text-teal-600" />
                      <p className="text-sm font-bold text-teal-700 leading-none">{co2Label}</p>
                    </div>
                    <p className="text-[10px] text-teal-600 font-medium">CO₂ сохранено</p>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start">

          {/* ── Left sidebar nav (desktop) ── */}
          <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 sticky top-6">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all ${
                  activeTab === item.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge > 0 && (
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    activeTab === item.id ? "bg-white/25 text-white" : "bg-primary text-white"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            {user.role === "owner" && (
              <div className="mt-3 pt-3 border-t border-border">
                <Link href="/dashboard/listings/new"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Добавить вещь
                </Link>
              </div>
            )}
          </aside>

          {/* ── Mobile tab grid ── */}
          <div className="lg:hidden w-full">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    activeTab === item.id
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge > 0 && (
                    <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      activeTab === item.id ? "bg-white/25 text-white" : "bg-primary text-white"
                    }`}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
            {user.role === "owner" && (
              <Link href="/dashboard/listings/new"
                className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 text-sm font-bold transition-colors border border-primary/20">
                <Plus className="w-4 h-4" /> Добавить вещь
              </Link>
            )}
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 lg:min-w-0">

            {/* ── INCOMING (owner) ── */}
            {activeTab === "incoming" && user.role === "owner" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ArrowDownCircle className="w-5 h-5 text-primary" />
                    Входящие заявки
                  </h2>
                  <span className="text-sm text-muted-foreground">{incomingBookings.length} всего</span>
                </div>

                {bookingsLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : incomingBookings.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-primary/50" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Заявок пока нет</h3>
                    <p className="text-muted-foreground text-sm">Когда арендаторы оставят заявки на ваши вещи — они появятся здесь</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <StatusFilterBar items={incomingBookings} value={incomingFilter} onChange={setIncomingFilter} />
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <select
                          value={incomingSort}
                          onChange={e => setIncomingSort(e.target.value as typeof incomingSort)}
                          className="text-sm font-medium text-foreground bg-white border border-border rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/50 transition-colors"
                        >
                          <option value="pending_first">Ожидающие первые</option>
                          <option value="newest">Новые сначала</option>
                          <option value="start_asc">Дата начала ↑</option>
                          <option value="price_desc">Сумма ↓</option>
                        </select>
                      </label>
                    </div>
                    {filteredIncoming.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-border">
                        <ListFilter className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground text-sm">Нет заявок с таким статусом</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredIncoming.map(b => <Fragment key={b.id}>{BookingCard({ booking: b, role: "owner" })}</Fragment>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── OUTGOING (renter) ── */}
            {activeTab === "outgoing" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5 text-accent" />
                    Мои бронирования
                  </h2>
                  <Link href="/catalog" className="text-sm text-primary font-semibold hover:underline">
                    + Новая аренда
                  </Link>
                </div>

                {bookingsLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : outgoingBookings.length === 0 ? (
                  user.role === "owner" ? (
                    <div className="bg-white rounded-2xl border border-border overflow-hidden">
                      {/* Role explanation banner */}
                      <div className="bg-gradient-to-r from-[#4A8587]/10 to-[#C65D3B]/10 px-6 py-5 border-b border-border flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
                          <span className="text-2xl">🔄</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-base mb-1">На платформе работает система двойных ролей</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Вы сейчас в роли <strong>Владельца</strong> — сдаёте вещи в аренду. Чтобы самому арендовать что-либо у других владельцев, переключитесь в режим <strong>Арендатора</strong>.
                          </p>
                        </div>
                      </div>
                      {/* Steps */}
                      <div className="px-6 py-5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Как начать арендовать</p>
                        <div className="space-y-3 mb-6">
                          {[
                            { step: "1", text: "Перейдите в Настройки профиля" },
                            { step: "2", text: 'Выберите роль "Арендатор"' },
                            { step: "3", text: "Откройте каталог и бронируйте" },
                          ].map(({ step, text }) => (
                            <div key={step} className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {step}
                              </div>
                              <p className="text-sm text-foreground">{text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => setActiveTab("profile")}
                            className="btn-primary px-5 py-2.5 rounded-xl text-sm"
                          >
                            Перейти в настройки
                          </button>
                          <Link href="/catalog"
                            className="inline-flex items-center px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
                            Смотреть каталог
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border">
                    <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ArrowUpCircle className="w-8 h-8 text-accent/50" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Вы ещё ничего не арендовали</h3>
                    <p className="text-muted-foreground text-sm mb-5">Найдите нужную вещь и отправьте заявку владельцу</p>
                    <Link href="/catalog" className="btn-primary inline-flex">Перейти в каталог</Link>
                  </div>
                  )
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <StatusFilterBar items={outgoingBookings} value={outgoingFilter} onChange={setOutgoingFilter} />
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <select
                          value={outgoingSort}
                          onChange={e => setOutgoingSort(e.target.value as typeof outgoingSort)}
                          className="text-sm font-medium text-foreground bg-white border border-border rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/50 transition-colors"
                        >
                          <option value="newest">Новые сначала</option>
                          <option value="active_first">Активные первые</option>
                          <option value="start_asc">Дата начала ↑</option>
                          <option value="price_desc">Сумма ↓</option>
                        </select>
                      </label>
                    </div>
                    {filteredOutgoing.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-border">
                        <ListFilter className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground text-sm">Нет заявок с таким статусом</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredOutgoing.map(b => <Fragment key={b.id}>{BookingCard({ booking: b, role: "renter" })}</Fragment>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORY ── */}
            {activeTab === "history" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-emerald-600" />
                    История сделок
                  </h2>
                  <span className="text-sm text-muted-foreground">{completedDeals.length} завершено</span>
                </div>

                {bookingsLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : completedDeals.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-border">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BadgeCheck className="w-8 h-8 text-emerald-300" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Завершённых сделок пока нет</h3>
                    <p className="text-muted-foreground text-sm">Здесь будут появляться успешно закрытые аренды</p>
                  </div>
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <div className="bg-white rounded-2xl border border-border p-4 text-center">
                        <div className="text-2xl font-bold font-display">{completedDeals.length}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">сделок всего</div>
                      </div>
                      {totalEarned > 0 && (
                        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
                          <div className="flex justify-center mb-1"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                          <div className="text-2xl font-bold font-display text-emerald-700">{formatPrice(totalEarned)}</div>
                          <div className="text-xs text-emerald-600 mt-0.5">заработано</div>
                        </div>
                      )}
                      {savingsVsBuying > 0 && (
                        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-center">
                          <div className="flex justify-center mb-1"><PiggyBank className="w-4 h-4 text-amber-600" /></div>
                          <div className="text-2xl font-bold font-display text-amber-700">~{formatPrice(savingsVsBuying)}</div>
                          <div className="text-xs text-amber-600 mt-0.5 leading-tight">экономия vs покупка</div>
                        </div>
                      )}
                      {co2SavedKg > 0 && (
                        <div className="bg-teal-50 rounded-2xl border border-teal-200 p-4 text-center">
                          <div className="flex justify-center mb-1"><Wind className="w-4 h-4 text-teal-600" /></div>
                          <div className="text-2xl font-bold font-display text-teal-700">{co2Label}</div>
                          <div className="text-xs text-teal-600 mt-0.5 leading-tight">CO₂ не выброшено</div>
                        </div>
                      )}
                    </div>

                    {/* Deal cards */}
                    <div className="space-y-3">
                      {completedDeals.map(({ booking: b, dealRole }) => {
                        const API_BASE = import.meta.env.VITE_API_URL ?? "";
                        const photoSrc = b.listingPhoto
                          ? (b.listingPhoto.startsWith("http") ? b.listingPhoto : `${API_BASE}${b.listingPhoto}`)
                          : null;
                        const isOwnerDeal = dealRole === "owner";
                        const partner = isOwnerDeal
                          ? { id: b.renterId, name: b.renterName, avatar: (b as any).renterAvatar }
                          : { id: b.ownerId, name: b.ownerName, avatar: undefined };

                        return (
                          <div key={`${dealRole}-${b.id}`}
                            className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row">
                              {/* Photo */}
                              <div className="relative w-full sm:w-28 h-24 sm:h-auto bg-muted shrink-0 overflow-hidden">
                                {photoSrc ? (
                                  <img src={photoSrc} className="w-full h-full object-cover" alt={b.listingTitle || ""} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-8 h-8 text-muted-foreground/30" />
                                  </div>
                                )}
                                {/* Completed stamp */}
                                <div className="absolute top-2 left-2">
                                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <BadgeCheck className="w-3 h-3" /> Завершено
                                  </span>
                                </div>
                              </div>

                              <div className="flex-grow p-4 min-w-0">
                                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                                  <div>
                                    <Link href={`/listings/${b.listingId}`}
                                      className="font-bold text-base hover:text-primary transition-colors leading-tight line-clamp-1">
                                      {b.listingTitle}
                                    </Link>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        isOwnerDeal ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                      }`}>
                                        {isOwnerDeal ? "🏠 Сдал в аренду" : "📦 Взял в аренду"}
                                      </span>
                                      {b.bookingNumber && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 border border-border/50 rounded-lg px-2 py-0.5 font-mono tracking-wide">
                                          № {b.bookingNumber}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {isOwnerDeal && (b as any).protectionEnabled === false ? (
                                      <div>
                                        <div className="text-sm font-bold text-orange-600 flex items-center justify-end gap-1">
                                          <Phone className="w-3.5 h-3.5" />Прямой расчёт
                                        </div>
                                        {(b as any).rentAmount > 0 && (
                                          <div className="text-xs text-muted-foreground">~{formatPrice((b as any).rentAmount)}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className={`text-xl font-bold font-display ${isOwnerDeal ? "text-emerald-700" : "text-teal-700"}`}>
                                        {isOwnerDeal ? "+" : ""}{formatPrice(isOwnerDeal ? ((b as any).rentAmount ?? b.totalPrice) : b.totalPrice)}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">{b.totalDays} {b.totalDays === 1 ? "сутки" : "суток"}</div>
                                    {!isOwnerDeal && <div className="text-[10px] text-teal-600 flex items-center justify-end gap-0.5 mt-0.5"><Leaf className="w-2.5 h-2.5" />вместо покупки</div>}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    {format(new Date(b.startDate), "dd.MM.yy")} — {format(new Date(b.endDate), "dd.MM.yy")}
                                  </span>
                                  <Link href={`/users/${partner.id}`}
                                    className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground overflow-hidden shrink-0">
                                      {partner.avatar ? (
                                        <img src={partner.avatar.startsWith("http") ? partner.avatar : `${API_BASE}${partner.avatar}`}
                                          className="w-full h-full object-cover" alt="" />
                                      ) : (
                                        partner.name?.charAt(0).toUpperCase() || <User className="w-3 h-3" />
                                      )}
                                    </div>
                                    <span>{isOwnerDeal ? "Арендатор:" : "Владелец:"} {partner.name}</span>
                                  </Link>
                                </div>

                                {/* Review buttons */}
                                {!reviewedIds.has(b.id) && (
                                  <div className="flex gap-2 flex-wrap mt-1">
                                    {!isOwnerDeal && (
                                      <button
                                        onClick={() => handleOpenReview(b, "renter")}
                                        className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors px-3 py-1.5 rounded-lg font-medium"
                                      >
                                        <Star className="w-3.5 h-3.5" /> Оценить вещь
                                      </button>
                                    )}
                                    {isOwnerDeal && (
                                      <button
                                        onClick={() => handleOpenReview(b, "owner")}
                                        className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors px-3 py-1.5 rounded-lg font-medium"
                                      >
                                        <Star className="w-3.5 h-3.5" /> Оценить арендатора
                                      </button>
                                    )}
                                  </div>
                                )}
                                {reviewedIds.has(b.id) && (
                                  <div className="flex items-center gap-1 text-xs text-green-700 mt-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Отзыв оставлен
                                  </div>
                                )}

                                {/* Кнопка «Подать претензию» — только для Premium-сделок */}
                                {(b as any).protectionEnabled !== false && (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => setSubmitClaimBooking({
                                        id: b.id,
                                        bookingNumber: b.bookingNumber,
                                        listingTitle: b.listingTitle,
                                        maxProtectionLimit: (b as any).maxProtectionLimit,
                                      })}
                                      className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors px-3 py-1.5 rounded-lg font-medium"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" /> Подать претензию
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── LISTINGS ── */}
            {activeTab === "listings" && user.role === "owner" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                    Мои объявления
                  </h2>
                  <Link href="/dashboard/listings/new" className="btn-primary gap-2 flex items-center text-sm">
                    <Plus className="w-4 h-4" /> Добавить
                  </Link>
                </div>

                {/* Listing filter */}
                {!listingsLoading && (listings?.length || 0) > 0 && (
                  <div className="flex gap-2 flex-wrap mb-5">
                    {([
                      { value: "all" as const, label: "Все", count: listings?.length || 0 },
                      { value: "active" as const, label: "Активные", count: activeListings.length },
                      { value: "hidden" as const, label: "Скрытые", count: hiddenListings.length },
                    ]).map(f => f.count > 0 || f.value === "all" ? (
                      <button
                        key={f.value}
                        onClick={() => setListingFilter(f.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                          listingFilter === f.value
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        {f.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                          listingFilter === f.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        }`}>{f.count}</span>
                      </button>
                    ) : null)}
                  </div>
                )}

                {listingsLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (listings?.length || 0) === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-8 h-8 text-primary/50" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Объявлений ещё нет</h3>
                    <p className="text-muted-foreground text-sm mb-5">Добавьте вещь и начните зарабатывать</p>
                    <Link href="/dashboard/listings/new" className="btn-primary inline-flex">Создать объявление</Link>
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-border">
                    <ListFilter className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground text-sm">Нет объявлений с таким фильтром</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredListings.map(listing => {
                      const API_BASE = import.meta.env.VITE_API_URL ?? "";
                      const photo = listing.photos?.[0];
                      const photoSrc = photo
                        ? (photo.startsWith("http") ? photo : `${API_BASE}${photo}`)
                        : "https://images.unsplash.com/photo-1581515320577-49520422c5cd?w=400";
                      return (
                        <div key={listing.id} className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow group">
                          <div className="aspect-video bg-muted relative overflow-hidden">
                            <img src={photoSrc} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={listing.title} />
                            {!listing.isAvailable && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="px-3 py-1 bg-white rounded-lg font-bold text-sm text-gray-700">Скрыто</span>
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-bold truncate mb-1">{listing.title}</h3>
                            <p className="text-xs text-muted-foreground mb-3">{listing.categoryName} • {listing.regionName}</p>

                            {/* Промо-статусы — только в коммерч. режиме */}
                            {isCommercialMode && (listing.isFeatured || listing.isUrgent || (listing.boostedUntil && new Date(listing.boostedUntil) > new Date())) && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {listing.isFeatured && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold">
                                    <Crown className="w-3 h-3" /> VIP
                                  </span>
                                )}
                                {listing.isUrgent && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 border border-red-300 text-red-800 text-[11px] font-bold">
                                    <Zap className="w-3 h-3" /> Срочно
                                  </span>
                                )}
                                {listing.boostedUntil && new Date(listing.boostedUntil) > new Date() && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 border border-orange-300 text-orange-800 text-[11px] font-bold">
                                    <Sparkles className="w-3 h-3" /> Топ
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex justify-between items-center mb-3">
                              <span className="font-bold text-primary">{formatPrice(listing.pricePerDay)}/сут</span>
                              <div className="flex items-center gap-3">
                                {isCommercialMode && (
                                  <button
                                    onClick={() => setPromoteListing({ id: listing.id, title: listing.title })}
                                    className="text-xs text-amber-700 hover:text-amber-800 font-bold inline-flex items-center gap-1"
                                    title="Продвинуть объявление"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Продвигать
                                  </button>
                                )}
                                <Link href={`/dashboard/listings/${listing.id}/edit`}
                                  className="text-xs text-muted-foreground hover:text-primary underline transition-colors font-medium">
                                  Редактировать
                                </Link>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <button
                                onClick={() => handleToggleVisibility(listing.id, listing.isAvailable)}
                                disabled={togglingId === listing.id}
                                className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  listing.isAvailable
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {togglingId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : listing.isAvailable ? <Eye className="w-3.5 h-3.5" />
                                  : <EyeOff className="w-3.5 h-3.5" />}
                                {listing.isAvailable ? "Активно" : "Скрыто"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(listing.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── WALLET (Stage 39) ── */}
            {activeTab === "wallet" && (
              <WalletSection token={token!} />
            )}

            {/* ── CONTACTS BALANCE ── */}
            {activeTab === "contacts" && (
              <ContactsBalanceSection token={token!} />
            )}

            {/* ── FINANCE ── */}
            {activeTab === "finance" && (
              <FinanceSection token={token!} claimRefreshNonce={claimRefreshNonce} />
            )}

            {/* ── SUPPORT ── */}
            {activeTab === "support" && (
              <div className="max-w-2xl w-full">
                <SupportSection
                  initialTicketId={
                    new URLSearchParams(search).get("ticket")
                      ? parseInt(new URLSearchParams(search).get("ticket")!)
                      : undefined
                  }
                />
              </div>
            )}

            {/* ── PROFILE / SETTINGS — ADMIN VARIANT ── */}
            {activeTab === "profile" && (user.role === "admin" || user.role === "superadmin") && (
              <div className="max-w-2xl w-full">
                <AdminAccountPanel
                  user={user}
                  avatarPreview={avatarPreview}
                  uploadingAvatar={uploadingAvatar}
                  onAvatarUpload={handleAvatarUpload}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  handleProfileSave={handleProfileSave}
                  profileSaved={profileSaved}
                  isSaving={updateProfile.isPending}
                  authHeaders={authHeaders}
                />

                {/* ── Stage 38: Telegram account linking (admin) ── */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4 text-[#2AABEE]" /> Telegram-уведомления
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Привяжите Telegram-аккаунт, чтобы получать уведомления и массовые рассылки прямо в мессенджере.
                  </p>

                  {tgLinked ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-green-700">Telegram привязан</span>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Типы уведомлений</label>
                        {([
                          { key: "bookings" as const, label: "Бронирования", desc: "Новые заявки, статусы, напоминания" },
                          { key: "system" as const, label: "Системные", desc: "Верификация, предупреждения, платежи" },
                          { key: "chats" as const, label: "Совместные покупки", desc: "Обновления пулов и долей" },
                        ]).map(({ key, label, desc }) => (
                          <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={tgPrefs[key]}
                              onChange={e => tgUpdatePref(key, e.target.checked)}
                              className="w-4 h-4 accent-primary rounded"
                            />
                            <div>
                              <span className="text-sm font-semibold">{label}</span>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button type="button" onClick={tgUnlink} disabled={tgBusy}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
                        {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Отвязать Telegram
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tgOtp ? (
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-700 font-semibold mb-1">Ваш код привязки:</p>
                            <p className="text-3xl font-mono font-bold text-blue-800 tracking-[0.3em]">{tgOtp.otp}</p>
                            <p className="text-xs text-blue-500 mt-2">Действителен 10 минут · истекает в {new Date(tgOtp.expiresAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          {tgBotUsername ? (
                            <a href={`https://t.me/${tgBotUsername}?start=${tgOtp.otp}`}
                              target="_blank" rel="noopener noreferrer"
                              className="btn-primary flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
                              <Send className="w-4 h-4" /> Открыть бота и привязать
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">Найдите бота платформы в Telegram и отправьте: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">/link {tgOtp.otp}</code></p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Ожидаем подтверждения от бота...
                          </p>
                          <button type="button" onClick={tgGenerateOtp} disabled={tgBusy}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" /> Обновить код
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={tgGenerateOtp} disabled={tgBusy}
                          className="btn-primary flex items-center gap-2 px-5 py-2.5">
                          {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Получить код привязки
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PROFILE / SETTINGS — RENTER/OWNER/STAFF ── */}
            {activeTab === "profile" && user.role !== "admin" && user.role !== "superadmin" && (
              <div className="max-w-2xl w-full">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-5">
                  <Settings className="w-5 h-5 text-primary" /> Настройки профиля
                </h2>

                {/* ── Avatar + stats card ── */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mb-4">
                  <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                    {/* Avatar upload */}
                    <div className="relative shrink-0 group">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                        {uploadingAvatar ? (
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : (avatarPreview || user.avatar) ? (
                          <img
                            src={avatarPreview || (user.avatar?.startsWith("http") ? user.avatar : `${import.meta.env.VITE_API_URL ?? ""}${user.avatar}`)}
                            className="w-full h-full object-cover"
                            alt={user.name}
                          />
                        ) : (
                          <span className="text-3xl font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-2xl transition-all cursor-pointer">
                        <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                        />
                      </label>
                    </div>

                    {/* Profile summary */}
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-xl font-bold">{user.name}</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">
                        {user.role === "owner" ? "Владелец" : "Арендатор"}
                        {user.regionName ? ` • ${user.regionName}` : ""}
                      </p>
                      {user.bio && <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{user.bio}</p>}

                      {/* Stats row */}
                      <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>С {format(new Date(user.createdAt), "MMMM yyyy")}</span>
                        </div>
                        {user.role === "owner" && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Package className="w-3.5 h-3.5" />
                            <span>{activeListings.length} объявлений</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{outgoingBookings.filter(b => b.status === "completed").length} завершённых аренд</span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1 justify-center sm:justify-start">
                        <Camera className="w-3 h-3" />
                        Нажмите на фото для замены (до 5 МБ)
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Stage 19g + 20a: Trust & Verification — статус «Проверенный владелец» ── */}
                {user.role === "owner" && (
                  <div className={`border rounded-2xl p-5 mb-4 shadow-sm ${(user as any).isVerified ? "bg-violet-50 border-violet-200" : verifPendingTicketId ? "bg-amber-50 border-amber-200" : "bg-white border-border"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(user as any).isVerified ? "bg-violet-100" : verifPendingTicketId ? "bg-amber-100" : "bg-stone-100"}`}>
                        <Award className={`w-5 h-5 ${(user as any).isVerified ? "text-violet-600" : verifPendingTicketId ? "text-amber-600" : "text-stone-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base">
                            {(user as any).isVerified ? "Проверенный владелец" : verifPendingTicketId ? "Заявка на рассмотрении" : "Верификация владельца"}
                          </h3>
                          {(user as any).isVerified && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                              ✓ активен
                            </span>
                          )}
                          {!(user as any).isVerified && verifPendingTicketId && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                              ⏳ ожидает админа
                            </span>
                          )}
                        </div>
                        {(user as any).isVerified ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            Ваш аккаунт верифицирован администрацией{(user as any).verifiedAt ? ` ${format(new Date((user as any).verifiedAt), "d MMMM yyyy")}` : ""}.
                            Бейдж «Проверенный владелец» отображается на всех ваших объявлениях и в профиле.
                          </p>
                        ) : verifPendingTicketId ? (
                          <>
                            <p className="text-sm text-muted-foreground mt-1">
                              Ваша заявка на верификацию ожидает рассмотрения. Ответ придёт в раздел «Поддержка».
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveTab("support")}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-50 transition"
                              >
                                Открыть «Поддержку»
                              </button>
                              <button
                                type="button"
                                disabled={verifCancelling}
                                onClick={async () => {
                                  if (!verifPendingTicketId) return;
                                  if (!confirm("Отозвать заявку на верификацию? Вы сможете подать её снова в любой момент.")) return;
                                  setVerifCancelling(true);
                                  try {
                                    const API_BASE = import.meta.env.VITE_API_URL ?? "";
                                    const r = await fetch(`${API_BASE}/api/support/tickets/${verifPendingTicketId}/cancel`, {
                                      method: "PATCH",
                                      headers: { ...authHeaders.headers },
                                    });
                                    if (r.ok) {
                                      setVerifPendingTicketId(null);
                                      toast({ title: "Заявка отозвана", description: "Вы можете подать новую заявку в любой момент." });
                                    } else {
                                      const data = await r.json().catch(() => ({}));
                                      toast({ title: "Ошибка", description: data.message ?? "Не удалось отозвать заявку", variant: "destructive" });
                                    }
                                  } finally {
                                    setVerifCancelling(false);
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                              >
                                {verifCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Отозвать заявку
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground mt-1">
                              Получите бейдж «Проверенный владелец», чтобы повысить доверие арендаторов. Это бесплатно и бессрочно.
                            </p>
                            <button
                              type="button"
                              onClick={() => { setVerifBody(""); setVerifModalOpen(true); }}
                              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition"
                            >
                              <Award className="w-4 h-4" /> Подать заявку на верификацию
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Stage 37: Служебный статус — для staff-ролей ── */}
                {(["superadmin","admin","moderator","support","arbiter"] as string[]).includes(user.role) && (() => {
                  const STAFF_META: Record<string, { label: string; border: string; icon: string }> = {
                    superadmin: { label: "Владелец платформы", border: "border-purple-200", icon: "text-purple-600" },
                    admin:      { label: "Администратор",       border: "border-[#C65D3B]/30", icon: "text-[#C65D3B]" },
                    moderator:  { label: "Модератор",           border: "border-sky-200",    icon: "text-sky-600" },
                    support:    { label: "Поддержка",           border: "border-teal-200",   icon: "text-teal-600" },
                    arbiter:    { label: "Арбитр",              border: "border-amber-200",  icon: "text-amber-600" },
                  };
                  const meta = STAFF_META[user.role] ?? { label: user.role, border: "border-border", icon: "text-muted-foreground" };
                  return (
                    <div className={`bg-white border ${meta.border} rounded-2xl p-5 mb-4 shadow-sm`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <Shield className={`w-5 h-5 ${meta.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-base">Служебный статус</h3>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0ea5e9] text-white">
                              <Shield className="w-3 h-3" /> Команда Хочу_То
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Ваша роль: <span className="font-semibold text-foreground">{meta.label}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Служебный аккаунт. Публичный профиль помечен бейджем «Команда Хочу_То».
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Stage 29: Trust Score — общий «индекс доверия» (0..100) ── */}
                {(() => {
                  const ts = (user as any).trustScore as number | null | undefined;
                  if (ts === null || ts === undefined) return null;
                  const updated = (user as any).trustScoreUpdatedAt as string | null | undefined;
                  const tier =
                    ts >= 80 ? { name: "Высокий", desc: "Партнёры охотно сотрудничают с вами." }
                    : ts >= 50 ? { name: "Средний", desc: "Хорошее начало — завершайте сделки и собирайте отзывы, чтобы расти." }
                    : { name: "Низкий", desc: "Постарайтесь избегать претензий и накапливать положительный опыт." };
                  return (
                    <div className="bg-white border border-border rounded-2xl p-5 mb-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-base">Индекс доверия</h3>
                            <TrustBadge score={ts} size="md" showLabel />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{tier.name} уровень.</span> {tier.desc}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Считается из среднего рейтинга отзывов, числа завершённых сделок, статуса верификации и претензий.
                            {updated ? ` Обновлено ${format(new Date(updated), "d MMMM yyyy")}.` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Main settings form ── */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                  <form className="space-y-6" onSubmit={handleProfileSave}>

                    {/* Role — hidden for admin users */}
                    {user.role !== "admin" && (
                    <div>
                      <label className="block text-xs font-bold mb-3 text-muted-foreground uppercase tracking-widest">Роль в сервисе</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: "renter", icon: "🔍", label: "Арендатор", desc: "Ищу вещи для аренды" },
                          { value: "owner", icon: "🏠", label: "Владелец", desc: "Сдаю свои вещи" },
                        ].map(r => (
                          <button key={r.value} type="button"
                            onClick={() => setProfileForm(f => ({ ...f, role: r.value as "renter" | "owner" }))}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                              profileForm.role === r.value
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40"
                            }`}>
                            <span className="text-2xl">{r.icon}</span>
                            <span className="font-bold text-sm">{r.label}</span>
                            <span className="text-xs text-center leading-tight opacity-75">{r.desc}</span>
                          </button>
                        ))}
                      </div>
                      {profileForm.role !== user.role && (
                        <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          ⚠️ После сохранения интерфейс обновится под новую роль
                        </p>
                      )}
                    </div>
                    )}

                    {/* Basic info */}
                    <div className="border-t border-border pt-5">
                      <label className="block text-xs font-bold mb-4 text-muted-foreground uppercase tracking-widest">Основная информация</label>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">Имя <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="text" className="input-field w-full pl-10" value={profileForm.name}
                              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} required />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">О себе</label>
                          <textarea
                            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none resize-none transition-all"
                            rows={3}
                            value={profileForm.bio}
                            onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                            placeholder="Расскажите о себе: что сдаёте, опыт, условия передачи..."
                            maxLength={500}
                          />
                          <p className="text-xs text-muted-foreground text-right mt-1">{profileForm.bio.length}/500</p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">Email</label>
                          <input type="email" className="input-field w-full bg-muted text-muted-foreground cursor-not-allowed"
                            defaultValue={user.email} disabled />
                          <p className="text-xs text-muted-foreground mt-1">Чтобы сменить email или пароль — используйте раздел «Безопасность» ниже</p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">Телефон</label>
                          <div className="relative">
                            <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="tel" className="input-field w-full pl-10" value={profileForm.phone}
                              onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                              placeholder="+7 (999) 000-00-00" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Показывается арендатору только после подтверждения заявки</p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">Регион</label>
                          <select className="input-field w-full" value={profileForm.regionId ?? ""}
                            onChange={e => setProfileForm(f => ({ ...f, regionId: e.target.value ? Number(e.target.value) : undefined }))}>
                            <option value="">— Выберите регион —</option>
                            {regions?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Social links */}
                    <div className="border-t border-border pt-5">
                      <label className="block text-xs font-bold mb-4 text-muted-foreground uppercase tracking-widest">Соцсети и контакты</label>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-[#2AABEE]" /> Telegram
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
                            <input type="text" className="input-field w-full pl-7" value={profileForm.telegram}
                              onChange={e => setProfileForm(f => ({ ...f, telegram: e.target.value.replace(/^@/, "") }))}
                              placeholder="username" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-primary" /> Сайт / ссылка
                          </label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="url" className="input-field w-full pl-10" value={profileForm.website}
                              onChange={e => setProfileForm(f => ({ ...f, website: e.target.value }))}
                              placeholder="https://t.me/mychannel или ваш сайт" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button type="submit" disabled={updateProfile.isPending}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                      {updateProfile.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {profileSaved ? "✓ Сохранено!" : "Сохранить изменения"}
                    </button>
                  </form>
                </div>

                {/* ── Stage 38: Telegram account linking ── */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4 text-[#2AABEE]" /> Telegram-уведомления
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Привяжите Telegram-аккаунт, чтобы получать уведомления о бронированиях и событиях прямо в мессенджере.
                  </p>

                  {tgLinked ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-green-700">Telegram привязан</span>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Типы уведомлений</label>
                        {([
                          { key: "bookings" as const, label: "Бронирования", desc: "Новые заявки, статусы, напоминания" },
                          { key: "system" as const, label: "Системные", desc: "Верификация, предупреждения, платежи" },
                          { key: "chats" as const, label: "Совместные покупки", desc: "Обновления пулов и долей" },
                        ]).map(({ key, label, desc }) => (
                          <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={tgPrefs[key]}
                              onChange={e => tgUpdatePref(key, e.target.checked)}
                              className="w-4 h-4 accent-primary rounded"
                            />
                            <div>
                              <span className="text-sm font-semibold">{label}</span>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      <button type="button" onClick={tgUnlink} disabled={tgBusy}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
                        {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Отвязать Telegram
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tgOtp ? (
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-700 font-semibold mb-1">Ваш код привязки:</p>
                            <p className="text-3xl font-mono font-bold text-blue-800 tracking-[0.3em]">{tgOtp.otp}</p>
                            <p className="text-xs text-blue-500 mt-2">Действителен 10 минут · истекает в {new Date(tgOtp.expiresAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          {tgBotUsername ? (
                            <a href={`https://t.me/${tgBotUsername}?start=${tgOtp.otp}`}
                              target="_blank" rel="noopener noreferrer"
                              className="btn-primary flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
                              <Send className="w-4 h-4" /> Открыть бота и привязать
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">Найдите бота платформы в Telegram и отправьте: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">/link {tgOtp.otp}</code></p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Ожидаем подтверждения от бота...
                          </p>
                          <button type="button" onClick={tgGenerateOtp} disabled={tgBusy}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" /> Обновить код
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={tgGenerateOtp} disabled={tgBusy}
                          className="btn-primary flex items-center gap-2 px-5 py-2.5">
                          {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Получить код привязки
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Stage 38-UE: Phone Verification via SMS ── */}
                {smsEnabled && (
                  <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mt-4">
                    <h3 className="text-base font-bold flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-emerald-600" /> Верификация телефона (SMS)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Верифицированный номер используется как резервный канал уведомлений и для подтверждения важных операций.
                    </p>

                    {phoneVerified ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-green-700">Телефон верифицирован</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {!(user as any)?.phone ? (
                          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
                            Сначала добавьте номер телефона в профиль выше.
                          </div>
                        ) : phoneOtpSent ? (
                          <div className="space-y-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                              <p className="text-sm text-blue-700 font-semibold mb-1">Введите код из SMS:</p>
                              {phoneOtpExpiresAt && (
                                <p className="text-xs text-blue-500 mb-3">
                                  Действителен до {new Date(phoneOtpExpiresAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={phoneOtpInput}
                                  onChange={e => setPhoneOtpInput(e.target.value.replace(/\D/g, ""))}
                                  placeholder="000000"
                                  className="flex-1 input-field font-mono text-center text-xl tracking-[0.3em]"
                                />
                                <button type="button" onClick={verifyPhoneOtp}
                                  disabled={phoneOtpBusy || phoneOtpInput.length < 4}
                                  className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
                                  {phoneOtpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  Подтвердить
                                </button>
                              </div>
                            </div>
                            <button type="button" onClick={sendPhoneOtp} disabled={phoneOtpBusy}
                              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                              <RefreshCw className="w-3.5 h-3.5" /> Отправить код повторно
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={sendPhoneOtp} disabled={phoneOtpBusy}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5">
                            {phoneOtpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                            Отправить код верификации
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Security card: email + password ── */}
                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                    <span className="text-lg">🔒</span> Безопасность
                  </h3>
                  <form className="space-y-4" onSubmit={handleCredentialsSave}>
                    <div>
                      <label className="block text-xs font-bold mb-3 text-muted-foreground uppercase tracking-widest">Текущие данные</label>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Текущий пароль <span className="text-red-500">*</span></label>
                        <input
                          type="password"
                          className="input-field w-full"
                          value={credForm.currentPassword}
                          onChange={e => setCredForm(f => ({ ...f, currentPassword: e.target.value }))}
                          placeholder="Введите текущий пароль"
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <label className="block text-xs font-bold mb-3 text-muted-foreground uppercase tracking-widest">Что хотите изменить</label>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">Новый email</label>
                          <input
                            type="email"
                            className="input-field w-full"
                            value={credForm.newEmail}
                            onChange={e => setCredForm(f => ({ ...f, newEmail: e.target.value }))}
                            placeholder={user.email}
                            autoComplete="email"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Оставьте пустым, если не меняете</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2">Новый пароль</label>
                          <input
                            type="password"
                            className="input-field w-full"
                            value={credForm.newPassword}
                            onChange={e => setCredForm(f => ({ ...f, newPassword: e.target.value }))}
                            placeholder="Минимум 6 символов"
                            autoComplete="new-password"
                          />
                        </div>
                        {credForm.newPassword && (
                          <div>
                            <label className="block text-sm font-semibold mb-2">Подтвердите новый пароль</label>
                            <input
                              type="password"
                              className="input-field w-full"
                              value={credForm.confirmPassword}
                              onChange={e => setCredForm(f => ({ ...f, confirmPassword: e.target.value }))}
                              placeholder="Повторите новый пароль"
                              autoComplete="new-password"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {credError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{credError}</p>
                    )}

                    <button type="submit" disabled={credPending}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                      {credPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {credSaved ? "✓ Данные обновлены!" : "Сохранить"}
                    </button>
                  </form>
                </div>

                {/* ── Danger Zone: Delete Account ── */}
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm mt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-2 text-red-700">
                    <AlertTriangle className="w-5 h-5" /> Опасная зона
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Удаление аккаунта необратимо. Личные данные будут анонимизированы, объявления — скрыты. История завершённых сделок сохранится.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteAccountModal(true); setDeleteConfirmText(""); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Удалить аккаунт
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Delete listing confirmation modal ── */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-center">Удалить объявление?</h3>
            <p className="text-muted-foreground text-sm mb-6 text-center">Это действие нельзя отменить. Все данные будут удалены навсегда.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                Отмена
              </button>
              <button onClick={() => handleDeleteListing(confirmDeleteId)} disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deletingId === confirmDeleteId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Account Confirmation Modal ── */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-center text-red-700">Удалить аккаунт?</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center leading-relaxed">
              Это действие <strong>необратимо</strong>. Ваши объявления будут скрыты, а личные данные удалены. История завершённых сделок сохранится для других пользователей.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2 text-center">
                Для подтверждения введите слово <span className="font-mono bg-red-100 px-1 rounded">УДАЛИТЬ</span>
              </p>
              <input
                type="text"
                className="input-field w-full text-center font-mono tracking-widest"
                placeholder="УДАЛИТЬ"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "УДАЛИТЬ" || deletingAccount}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guard Modals ─────────────────────────────────────────────────────── */}
      {guardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && closeGuard()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

            {/* ── EARLY HANDOVER ─── */}
            {guardModal.type === "early_handover" && !rescheduleMode && (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xl">⚠️</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Аренда ещё не началась</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Дата начала: <span className="font-semibold text-foreground">{guardModal.booking.startDate}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Если вы уже договорились с арендатором о досрочной передаче — подтвердите. Либо скорректируйте даты, чтобы они совпадали с реальными.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setRescheduleMode(true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-primary text-primary rounded-xl text-sm font-bold hover:bg-primary/5 transition-colors">
                    📅 Изменить даты бронирования
                  </button>
                  <button
                    onClick={() => { closeGuard(); handleStatusChange(guardModal.booking.id, "active"); }}
                    disabled={updatingId === guardModal.booking.id}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                    {updatingId === guardModal.booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Подтвердить досрочную передачу
                  </button>
                  <button onClick={closeGuard} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Отмена
                  </button>
                </div>
              </>
            )}

            {/* ── RESCHEDULE FORM ─── */}
            {guardModal.type === "early_handover" && rescheduleMode && (() => {
              const days = rescheduleStart && rescheduleEnd
                ? Math.max(1, Math.ceil((new Date(rescheduleEnd).getTime() - new Date(rescheduleStart).getTime()) / 86_400_000))
                : 0;
              const pricePerDay = Number(guardModal.booking.listing?.pricePerDay ?? 0);
              const newTotal = days * pricePerDay;
              return (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xl">📅</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Изменить даты аренды</h3>
                      <p className="text-xs text-muted-foreground font-mono">{guardModal.booking.bookingNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Начало</label>
                      <input type="date" value={rescheduleStart} onChange={e => { setRescheduleStart(e.target.value); setRescheduleErr(""); }}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:border-primary outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Конец</label>
                      <input type="date" value={rescheduleEnd} onChange={e => { setRescheduleEnd(e.target.value); setRescheduleErr(""); }}
                        min={rescheduleStart || new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:border-primary outline-none transition-all" />
                    </div>
                  </div>

                  {days > 0 && (
                    <div className="mb-4 px-4 py-3 bg-muted rounded-xl text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{days} {days === 1 ? "день" : "дней"} × {pricePerDay} ₽/день</span>
                        <span className="font-bold">{newTotal.toLocaleString("ru")} ₽</span>
                      </div>
                    </div>
                  )}

                  {rescheduleErr && (
                    <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{rescheduleErr}</div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setRescheduleMode(false); setRescheduleErr(""); }}
                      className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                      Назад
                    </button>
                    <button onClick={handleRescheduleSubmit} disabled={rescheduleSubmitting}
                      className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {rescheduleSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Сохранить даты
                    </button>
                  </div>
                </>
              );
            })()}

            {/* ── EARLY RETURN ─── */}
            {guardModal.type === "early_return" && (() => {
              const today = new Date().toISOString().slice(0, 10);
              const endDate = guardModal.booking.endDate;
              const daysLeft = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / 86_400_000);
              return (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xl">⏰</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">Досрочный возврат</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Срок аренды — до <span className="font-semibold text-foreground">{endDate}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    Осталось <strong>{daysLeft} {daysLeft === 1 ? "день" : "дней"}</strong> оплаченного времени. Стоимость аренды при досрочном возврате <strong>не пересчитывается</strong>.
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    Подтверждая досрочный возврат, вы инициируете процесс приёмки. Владелец получит уведомление.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={closeGuard}
                      className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                      Отмена
                    </button>
                    <button
                      onClick={() => { closeGuard(); handleStatusChange(guardModal.booking.id, "return_pending"); }}
                      disabled={updatingId === guardModal.booking.id}
                      className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {updatingId === guardModal.booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                      Да, возвращаю досрочно
                    </button>
                  </div>
                </>
              );
            })()}

            {/* ── CANCEL CONFIRM ─── */}
            {guardModal.type === "cancel_confirm" && (() => {
              const st = guardModal.booking.status;
              const isPending = st === "pending";
              const isConfirmed = st === "confirmed";
              const isActive = st === "active";
              const isReturnPending = st === "return_pending";
              const title = isPending ? "Отменить заявку?" : "Отменить сделку?";
              const keepLabel = isPending ? "Оставить заявку" : "Не отменять";
              const hint = isPending
                ? "Заявка будет отменена. Владелец получит уведомление."
                : isConfirmed
                  ? "Бронирование уже подтверждено. Отмена прекратит сделку — обе стороны получат уведомление."
                  : isActive
                    ? "Вещь сейчас у арендатора. Досрочная отмена прекратит аренду — рекомендуем сначала договориться о возврате вещи."
                    : isReturnPending
                      ? "Арендатор уже инициировал возврат. Отмена прекратит сделку — обе стороны получат уведомление."
                      : "Сделка будет отменена. Это действие нельзя отменить.";
              const warningColor = isPending ? "bg-red-100" : "bg-orange-100";
              return (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full ${warningColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="text-xl">🚫</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        «{guardModal.booking.listing?.title ?? "Объявление"}»
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{hint}</p>
                  {!isPending && (
                    <p className="text-xs text-red-500 font-medium mb-4">Это действие нельзя отменить.</p>
                  )}
                  {isPending && <div className="mb-4" />}
                  <div className="flex gap-3">
                    <button onClick={closeGuard}
                      className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                      {keepLabel}
                    </button>
                    <button
                      onClick={() => { closeGuard(); handleStatusChange(guardModal!.booking.id, "cancelled"); }}
                      disabled={updatingId === guardModal.booking.id}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {updatingId === guardModal.booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Да, отменить
                    </button>
                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Отклонить заявку?</h3>
                <p className="text-sm text-muted-foreground">Арендатор получит уведомление об отказе</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Причина отказа <span className="text-muted-foreground font-normal">(необязательно)</span>
              </label>
              <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)}
                placeholder="Например: вещь уже занята на эти даты..."
                rows={3} autoFocus
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none resize-none transition-all" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectComment(""); }}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                Отмена
              </button>
              <button onClick={handleRejectConfirm} disabled={updatingId === rejectModal.bookingId}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {updatingId === rejectModal.bookingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && setReviewingBooking(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold mb-0.5">
                {reviewingBooking.role === "renter" ? "Оценить вещь" : "Оценить арендатора"}
              </h3>
              {reviewingBooking.number && (
                <p className="text-xs text-muted-foreground font-mono">Бронирование {reviewingBooking.number}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Ваша оценка *</label>
              <StarRating
                value={reviewRating}
                size="lg"
                interactive
                hovered={reviewHover}
                onChange={setReviewRating}
                onHover={setReviewHover}
                onLeave={() => setReviewHover(0)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Комментарий <span className="font-normal">(необязательно)</span>
              </label>
              <textarea
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none resize-none transition-all min-h-[90px]"
                placeholder={reviewingBooking.role === "renter"
                  ? "Расскажите о вещи и опыте аренды..."
                  : "Расскажите о поведении арендатора..."}
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                maxLength={1000}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReviewingBooking(null)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmitDashboardReview}
                disabled={reviewSubmitting || reviewRating === 0}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stage 19g: Verification Request Modal ── */}
      {verifModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && !verifSubmitting && setVerifModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Заявка на верификацию</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Бесплатно, бессрочно. Рассмотрение до 3 рабочих дней.</p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-700">Что приложить:</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li>Подтверждение личности (паспорт или права — фото первой страницы)</li>
                <li>Подтверждение, что вещи действительно ваши (чек, фото с серийным номером, документы)</li>
                <li>Контактный телефон (если ещё не указан в профиле)</li>
              </ul>
              <p className="text-[11px] text-stone-500 mt-2">Документы будут видны только администраторам сервиса. Можно отправить ссылки или приложить файлы в переписке тикета после создания.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Расскажите о себе *</label>
              <textarea
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none resize-none transition-all min-h-[120px]"
                placeholder="Например: «Сдаю фототехнику с 2022 года, около 30 завершённых сделок. Готов прислать сканы паспорта и чеки на оборудование в переписке.»"
                value={verifBody}
                onChange={e => setVerifBody(e.target.value)}
                maxLength={2000}
                autoFocus
                disabled={verifSubmitting}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">{verifBody.length}/2000</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerifModalOpen(false)}
                disabled={verifSubmitting}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={verifSubmitting || verifBody.trim().length < 20}
                onClick={async () => {
                  if (verifBody.trim().length < 20) return;
                  setVerifSubmitting(true);
                  try {
                    const r = await fetch(`${API_BASE}/api/support/tickets`, {
                      method: "POST",
                      headers: { ...authHeaders.headers, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        subject: `Заявка на верификацию: ${user.name}`,
                        body: verifBody.trim(),
                        category: "verification_request",
                      }),
                    });
                    if (r.ok) {
                      const data = await r.json().catch(() => ({}));
                      // Stage 20a — сразу запоминаем id заявки, чтобы показать «Отозвать»
                      if (data?.id) setVerifPendingTicketId(data.id);
                      toast({ title: "Заявка отправлена", description: "Администратор рассмотрит её в ближайшее время. Ответ придёт в раздел «Поддержка»." });
                      setVerifModalOpen(false);
                      setVerifBody("");
                      setActiveTab("support");
                    } else if (r.status === 409) {
                      const data = await r.json().catch(() => ({}));
                      // Stage 20a — у юзера уже есть заявка; запомним её id для «Отозвать»
                      if (data?.ticketId) setVerifPendingTicketId(data.ticketId);
                      toast({ title: "Заявка уже подана", description: data.message ?? "Дождитесь ответа администратора в разделе «Поддержка».", variant: "destructive" });
                      setVerifModalOpen(false);
                      setActiveTab("support");
                    } else {
                      const data = await r.json().catch(() => ({}));
                      toast({ title: "Ошибка", description: data.message ?? "Не удалось отправить заявку", variant: "destructive" });
                    }
                  } finally {
                    setVerifSubmitting(false);
                  }
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                Отправить заявку
              </button>
            </div>
          </div>
        </div>
      )}

      {submitClaimBooking && (
        <SubmitClaimModal
          token={token}
          booking={submitClaimBooking}
          onClose={() => setSubmitClaimBooking(null)}
          onSuccess={() => {
            setSubmitClaimBooking(null);
            setClaimRefreshNonce(n => n + 1);
          }}
        />
      )}

      {/* Stage 22a — модалка загрузки Цифрового акта */}
      {digitalActModal && (
        <DigitalActUpload
          bookingId={digitalActModal.bookingId}
          type={digitalActModal.type}
          onClose={() => setDigitalActModal(null)}
          onSuccess={() => {
            toast({
              title: digitalActModal.type === "check_in" ? "✅ Акт приёмки сохранён" : "✅ Акт возврата сохранён",
              description: "Теперь вы можете передать/вернуть вещь.",
            });
            setDigitalActModal(null);
            void refetchBookings();
          }}
        />
      )}
    </Layout>
  );
}

// ════════════════════════════════════════════════════════════════════
// WalletSection — кошелёк пользователя (Stage 39 Escrow Engine)
// Виден только в коммерческом режиме (isCommercialMode=true).
// ════════════════════════════════════════════════════════════════════

interface WalletBalance {
  availableBalance: number;
  frozenBalance: number;
  currency: string;
  updatedAt: string;
}

interface WalletTx {
  id: number;
  amount: number;
  platformCommission: number;
  type: string;
  status: string;
  referenceId: number | null;
  referenceType: string | null;
  description: string | null;
  createdAt: string;
}

const TX_LABELS: Record<string, { label: string; color: string }> = {
  hold:       { label: "Заморозка",   color: "text-amber-700" },
  release:    { label: "Разморозка",  color: "text-blue-700" },
  commission: { label: "Комиссия",    color: "text-red-700" },
  payout:     { label: "Выплата",     color: "text-emerald-700" },
  refund:     { label: "Возврат",     color: "text-sky-700" },
  topup:      { label: "Пополнение",  color: "text-violet-700" },
};

function WalletSection({ token }: { token: string }) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [history, setHistory] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [bRes, hRes] = await Promise.all([
          fetch(`${API_BASE}/api/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/wallet/history`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!bRes.ok) throw new Error(String(bRes.status));
        const b: WalletBalance = await bRes.json();
        const h: WalletTx[] = hRes.ok ? await hRes.json() : [];
        if (!cancelled) { setBalance(b); setHistory(h); }
      } catch (e: any) {
        if (!cancelled) setError(e?.message === "403" ? "Кошелёк доступен только в коммерческом режиме" : "Не удалось загрузить данные");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, API_BASE]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="max-w-xl w-full">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{error}</div>
    </div>
  );

  return (
    <div className="max-w-2xl w-full space-y-6">
      {/* ── Балансы ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Кошелёк
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-700 font-medium mb-1">Доступно</p>
            <p className="text-2xl font-bold text-emerald-800">
              {(balance?.availableBalance ?? 0).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 font-medium mb-1">Заморожено (эскроу)</p>
            <p className="text-2xl font-bold text-amber-800">
              {(balance?.frozenBalance ?? 0).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
            </p>
          </div>
        </div>
        {balance?.updatedAt && (
          <p className="text-xs text-stone-400 mt-3">
            Обновлено: {new Date(balance.updatedAt).toLocaleString("ru-RU")}
          </p>
        )}
      </div>

      {/* ── История транзакций ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-stone-800">История транзакций</h3>
        </div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Транзакций пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((tx) => {
              const info = TX_LABELS[tx.type] ?? { label: tx.type, color: "text-stone-600" };
              return (
                <div key={tx.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${info.color}`}>{info.label}</span>
                      {tx.referenceId && (
                        <span className="text-xs text-stone-400">
                          {tx.referenceType === "booking" ? `бронь #${tx.referenceId}` : `#${tx.referenceId}`}
                        </span>
                      )}
                    </div>
                    {tx.description && (
                      <p className="text-xs text-stone-500 mt-0.5 truncate">{tx.description}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">
                      {new Date(tx.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm ${info.color}`}>
                      {tx.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                    </p>
                    {tx.platformCommission > 0 && (
                      <p className="text-xs text-stone-400">комиссия {tx.platformCommission.toFixed(2)} ₽</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ContactsBalanceSection — баланс контактов, пополнение, история
// ════════════════════════════════════════════════════════════════════
interface ContactBalanceData {
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

interface UnlockData {
  id: number;
  listingId: number;
  source: string;
  unlockedAt: string;
  expiresAt: string | null;
  active: boolean;
}

// ─── FINANCE SECTION ─────────────────────────────────────────────────────────

type FinanceEntry = {
  id: string;
  date: string;
  type: "rent_payout" | "rent_paid" | "direct_cash_in" | "direct_cash_out"
    | "contact_fee_paid" | "contact_topup" | "fund_in" | "fund_out"
    | "deposit_hold" | "deposit_release"
    | "payout_request" | "payout_paid" | "payout_rejected";
  direction: "in" | "out";
  amount: number;
  status: "pending" | "settled" | "off_platform" | "held";
  bookingId?: number;
  bookingNumber?: string;
  listingTitle?: string;
  counterparty?: string;
  description: string;
};

type FinanceData = {
  summary: {
    lifetimeEarned: number;
    lifetimeSpent: number;
    pendingPayout: number;
    pendingDeposit: number;
    availableForPayout?: number;
    inActiveRequests?: number;
  };
  entries: FinanceEntry[];
};

type PayoutMethod = {
  id: number;
  type: "card" | "sbp";
  cardLast4: string | null;
  cardHolderName: string | null;
  bankName: string | null;
  sbpPhone: string | null;
  sbpBank: string | null;
  isDefault: boolean;
};

type PayoutRequest = {
  id: number;
  amountRub: number;
  status: "pending" | "approved" | "paid" | "rejected";
  methodSnapshot: { type: string; cardLast4?: string | null; sbpBank?: string | null; cardHolderName?: string | null };
  bookingIds: number[];
  paymentRef: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PayoutsData = {
  available: number;
  totalEarned: number;
  pendingInRequests: number;
  eligibleBookings: { id: number; bookingNumber: string | null; ownerPayout: number }[];
  requests: PayoutRequest[];
  minPayoutRub: number;
};

const ENTRY_LABELS: Record<FinanceEntry["type"], string> = {
  rent_payout: "Выплата за аренду",
  rent_paid: "Оплата аренды",
  direct_cash_in: "Наличные от арендатора",
  direct_cash_out: "Наличные владельцу",
  contact_fee_paid: "Открытие контактов",
  contact_topup: "Пополнение баланса контактов",
  fund_in: "Гарантийный фонд",
  fund_out: "Выплата из фонда",
  deposit_hold: "Залог удержан",
  deposit_release: "Залог возвращён",
  payout_request: "Заявка на выплату",
  payout_paid: "Выплата выполнена",
  payout_rejected: "Заявка отклонена",
};

const PAYOUT_STATUS_LABELS: Record<PayoutRequest["status"], { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Одобрена · ожидает перевода", cls: "bg-blue-100 text-blue-800" },
  paid: { label: "Выплачено", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Отклонено", cls: "bg-rose-100 text-rose-800" },
};

const STATUS_LABELS: Record<FinanceEntry["status"], { label: string; cls: string }> = {
  settled: { label: "Зачислено", cls: "bg-green-100 text-green-800" },
  pending: { label: "Ожидает", cls: "bg-amber-100 text-amber-800" },
  held: { label: "На удержании", cls: "bg-blue-100 text-blue-800" },
  off_platform: { label: "Вне платформы", cls: "bg-stone-100 text-stone-700" },
};

function FinanceSection({ token, claimRefreshNonce }: { token: string; claimRefreshNonce?: number }) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in" | "out" | "pending">("all");
  const [reloadCounter, setReloadCounter] = useState(0);
  const onPayoutChange = useCallback(() => setReloadCounter(c => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/me/finance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error("fail");
        const j: FinanceData = await r.json();
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setData({ summary: { lifetimeEarned: 0, lifetimeSpent: 0, pendingPayout: 0, pendingDeposit: 0 }, entries: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, API_BASE, reloadCounter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const filtered = entries.filter(e => {
    if (filter === "all") return true;
    if (filter === "pending") return e.status === "pending" || e.status === "held";
    return e.direction === filter;
  });
  const summary = data?.summary ?? { lifetimeEarned: 0, lifetimeSpent: 0, pendingPayout: 0, pendingDeposit: 0 };

  return (
    <div className="w-full max-w-5xl">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
        <Coins className="w-5 h-5 text-primary" /> Финансы
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Полная детализация поступлений, расходов и удержаний по вашим сделкам.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-green-700 mb-1">
            <ArrowDownToLine className="w-3.5 h-3.5" /> Заработано
          </div>
          <p className="text-2xl font-display font-black text-green-800">{formatPrice(summary.lifetimeEarned)}</p>
          <p className="text-[11px] text-green-700/80 mt-1">за всё время</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-amber-700 mb-1">
            <Clock className="w-3.5 h-3.5" /> Ожидается выплата
          </div>
          <p className="text-2xl font-display font-black text-amber-800">{formatPrice(summary.pendingPayout)}</p>
          <p className="text-[11px] text-amber-700/80 mt-1">после завершения сделок</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-rose-700 mb-1">
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Потрачено
          </div>
          <p className="text-2xl font-display font-black text-rose-800">{formatPrice(summary.lifetimeSpent)}</p>
          <p className="text-[11px] text-rose-700/80 mt-1">на платформе</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-blue-700 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Залог в удержании
          </div>
          <p className="text-2xl font-display font-black text-blue-800">{formatPrice(summary.pendingDeposit)}</p>
          <p className="text-[11px] text-blue-700/80 mt-1">вернётся после возврата вещи</p>
        </div>
      </div>

      {/* Payouts block (для владельцев — выводы средств) */}
      <PayoutsBlock token={token} reloadCounter={reloadCounter} onChange={onPayoutChange} />

      {/* My claims (компенсации из гарантийного фонда) */}
      <MyClaimsBlock token={token} reloadCounter={(claimRefreshNonce ?? 0) + reloadCounter} />

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        {([
          { key: "all", label: "Все" },
          { key: "in", label: "Поступления" },
          { key: "out", label: "Расходы" },
          { key: "pending", label: "Ожидающие" },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? "bg-primary text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Пока нет транзакций</p>
            <p className="text-xs mt-1">Они появятся после первой сделки</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(e => {
              const st = STATUS_LABELS[e.status];
              const isIn = e.direction === "in";
              return (
                <li key={e.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      isIn ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"
                    }`}>
                      {isIn ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {ENTRY_LABELS[e.type]}
                            {e.listingTitle && (
                              <span className="text-muted-foreground font-normal"> · {e.listingTitle}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {e.description}
                            {e.counterparty && <span className="ml-1">· {e.counterparty}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm ${isIn ? "text-green-700" : "text-rose-700"}`}>
                            {isIn ? "+" : "−"}{formatPrice(e.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(e.date), "dd.MM.yy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                        {e.bookingNumber && (
                          <Link
                            href={`/dashboard?booking=${e.bookingNumber}`}
                            className="text-[10px] text-primary hover:underline"
                          >
                            {e.bookingNumber}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        💡 <b>«На удержании»</b> — деньги зарезервированы платформой (эскроу/фонд) и будут переведены после завершения сделки.
        <b> «Вне платформы»</b> — расчёт между арендатором и владельцем напрямую (наличные).
        После подключения боевых платежей здесь появится экспорт чеков и история переводов.
      </p>
    </div>
  );
}

// ─── PAYOUTS BLOCK (внутри FinanceSection) ──────────────────────────────────

function PayoutsBlock({
  token,
  reloadCounter,
  onChange,
}: {
  token: string;
  reloadCounter: number;
  onChange: () => void;
}) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [data, setData] = useState<PayoutsData | null>(null);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`${API_BASE}/api/me/payouts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/me/payout-methods`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (pRes.ok) setData(await pRes.json());
      if (mRes.ok) {
        const j = await mRes.json();
        setMethods(j.methods ?? []);
      }
    } catch {
      // silent — пользователь может быть не владельцем
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => { reload(); }, [reload, reloadCounter]);

  // Если нет ни одной заявки и нет доступной суммы и нет totalEarned — скрываем
  // (это либо арендатор, либо новый владелец без сделок)
  if (loading) return null;
  const hasAnyPayoutActivity =
    !!data && (data.totalEarned > 0 || data.requests.length > 0 || data.available > 0);
  if (!hasAnyPayoutActivity) return null;

  const available = data?.available ?? 0;
  const minRub = data?.minPayoutRub ?? 500;
  const canRequest = available >= minRub;

  return (
    <div className="bg-white border border-border rounded-2xl p-5 mb-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Вывод средств
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Заработанные деньги по защищённым сделкам можно вывести на свою карту или СБП.
          </p>
        </div>
        <button
          onClick={() => setShowMethods(s => !s)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {showMethods ? "Скрыть реквизиты" : `Реквизиты (${methods.length})`}
          <ChevronRight className={`w-3 h-3 transition-transform ${showMethods ? "rotate-90" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wide">Доступно к выводу</p>
          <p className="text-2xl font-display font-black text-emerald-800 mt-1">{formatPrice(available)}</p>
          {!canRequest && available > 0 && (
            <p className="text-[10px] text-emerald-700/70 mt-1">мин. {formatPrice(minRub)} для заявки</p>
          )}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">В активных заявках</p>
          <p className="text-2xl font-display font-black text-amber-800 mt-1">{formatPrice(data?.pendingInRequests ?? 0)}</p>
          <p className="text-[10px] text-amber-700/70 mt-1">ожидают перевода</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
          <p className="text-[11px] text-stone-700 font-semibold uppercase tracking-wide">Всего заработано</p>
          <p className="text-2xl font-display font-black text-stone-800 mt-1">{formatPrice(data?.totalEarned ?? 0)}</p>
          <p className="text-[10px] text-stone-700/70 mt-1">завершённых сделок</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setError(null);
            if (methods.length === 0) {
              setShowMethodModal(true);
              return;
            }
            setShowRequestModal(true);
          }}
          disabled={!canRequest}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:bg-stone-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Запросить выплату
        </button>
        {methods.length === 0 && (
          <button
            onClick={() => setShowMethodModal(true)}
            className="px-4 py-2 rounded-xl border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/5 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Добавить реквизиты
          </button>
        )}
      </div>

      {showMethods && (
        <PayoutMethodsList
          methods={methods}
          token={token}
          onChanged={() => { reload(); }}
          onAdd={() => setShowMethodModal(true)}
        />
      )}

      {/* Список заявок пользователя */}
      {data && data.requests.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden mt-2">
          <div className="bg-stone-50 px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Мои заявки на выплату
          </div>
          <ul className="divide-y divide-border text-sm">
            {data.requests.map(r => {
              const st = PAYOUT_STATUS_LABELS[r.status];
              const m = r.methodSnapshot;
              const methodLabel = m.type === "card"
                ? `Карта •••• ${m.cardLast4 ?? "****"}`
                : m.type === "sbp" ? `СБП · ${getSbpBankName(m.sbpBank)}` : "Реквизиты";
              return (
                <li key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{formatPrice(r.amountRub)}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {methodLabel} · {format(new Date(r.createdAt), "dd.MM.yy HH:mm")}
                      {r.status === "paid" && r.paymentRef && <> · Перевод: <b>{r.paymentRef}</b></>}
                      {r.status === "rejected" && r.rejectionReason && <> · Причина: {r.rejectionReason}</>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showRequestModal && data && (
        <RequestPayoutModal
          token={token}
          methods={methods}
          available={available}
          minRub={minRub}
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => { setShowRequestModal(false); reload(); onChange(); }}
        />
      )}

      {showMethodModal && (
        <AddPayoutMethodModal
          token={token}
          onClose={() => setShowMethodModal(false)}
          onSuccess={() => { setShowMethodModal(false); reload(); }}
        />
      )}
    </div>
  );
}

function PayoutMethodsList({
  methods,
  token,
  onChanged,
  onAdd,
}: {
  methods: PayoutMethod[];
  token: string;
  onChanged: () => void;
  onAdd: () => void;
}) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<{ id: number; msg: string } | null>(null);

  const setDefault = async (id: number) => {
    setBusyId(id);
    setErrorId(null);
    try {
      await fetch(`${API_BASE}/api/me/payout-methods/${id}/default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      onChanged();
    } finally { setBusyId(null); }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить эти реквизиты?")) return;
    setBusyId(id);
    setErrorId(null);
    try {
      const r = await fetch(`${API_BASE}/api/me/payout-methods/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrorId({ id, msg: j.message ?? "Не удалось удалить" });
      } else onChanged();
    } finally { setBusyId(null); }
  };

  return (
    <div className="border border-border rounded-xl mb-4">
      <div className="bg-stone-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Мои реквизиты</span>
        <button onClick={onAdd} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Добавить
        </button>
      </div>
      {methods.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Реквизиты ещё не добавлены</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {methods.map(m => (
            <li key={m.id} className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {m.type === "card" ? <CreditCard className="w-4 h-4 text-stone-500" /> : <Smartphone className="w-4 h-4 text-stone-500" />}
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {m.type === "card"
                      ? `Карта •••• ${m.cardLast4}`
                      : `СБП · ${getSbpBankName(m.sbpBank)}`}
                    {m.isDefault && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700"><StarIcon className="w-3 h-3 fill-amber-500 text-amber-500" /> по умолчанию</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.cardHolderName}
                    {m.bankName && ` · ${m.bankName}`}
                    {m.sbpPhone && ` · ${m.sbpPhone}`}
                  </div>
                  {errorId?.id === m.id && (
                    <div className="text-[11px] text-rose-700 mt-0.5">{errorId.msg}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!m.isDefault && (
                  <button
                    onClick={() => setDefault(m.id)}
                    disabled={busyId === m.id}
                    className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-stone-50 disabled:opacity-50"
                  >
                    Сделать основным
                  </button>
                )}
                <button
                  onClick={() => remove(m.id)}
                  disabled={busyId === m.id}
                  className="text-xs px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestPayoutModal({
  token,
  methods,
  available,
  minRub,
  onClose,
  onSuccess,
}: {
  token: string;
  methods: PayoutMethod[];
  available: number;
  minRub: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const defaultId = methods.find(m => m.isDefault)?.id ?? methods[0]?.id ?? 0;
  const [methodId, setMethodId] = useState(defaultId);
  const [amount, setAmount] = useState<string>(String(available));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const amt = Math.floor(Number(amount));
      if (!Number.isFinite(amt) || amt < minRub) {
        setError(`Минимум ${minRub} ₽`);
        setBusy(false);
        return;
      }
      if (amt > available) {
        setError(`Доступно только ${available} ₽`);
        setBusy(false);
        return;
      }
      const r = await fetch(`${API_BASE}/api/me/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutMethodId: methodId, amountRub: amt }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.message ?? "Не удалось создать заявку");
        setBusy(false);
        return;
      }
      onSuccess();
    } catch (e) {
      setError("Сетевая ошибка");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Запросить выплату</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Куда выплатить
            </label>
            <select
              value={methodId}
              onChange={e => setMethodId(Number(e.target.value))}
              className="input-field w-full"
            >
              {methods.map(m => (
                <option key={m.id} value={m.id}>
                  {m.type === "card" ? `Карта •••• ${m.cardLast4}` : `СБП · ${getSbpBankName(m.sbpBank)}`} — {m.cardHolderName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Сумма
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={minRub}
                max={available}
                className="input-field w-full pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₽</span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>мин. {formatPrice(minRub)}</span>
              <button
                onClick={() => setAmount(String(available))}
                className="text-primary hover:underline"
              >
                Вывести всё ({formatPrice(available)})
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
            Платёжный шлюз пока не подключён — администратор переведёт средства вручную в течение 1-3 рабочих дней
            после одобрения заявки. Вы получите уведомление со ссылкой на чек.
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={busy || methods.length === 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:bg-stone-300"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Создать заявку"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPayoutMethodModal({
  token,
  onClose,
  onSuccess,
}: {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [type, setType] = useState<"card" | "sbp">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [sbpPhone, setSbpPhone] = useState("");
  const [sbpBank, setSbpBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    // Stage 20b — клиент-side валидация СБП-телефона до отправки на сервер.
    if (type === "sbp") {
      const cleanPhone = extractCleanPhone(sbpPhone);
      if (!cleanPhone) {
        setError("Введите мобильный номер в формате +7 (9XX) XXX-XX-XX");
        setBusy(false);
        return;
      }
      if (!sbpBank) {
        setError("Выберите банк-получатель");
        setBusy(false);
        return;
      }
    }
    try {
      const body = type === "card"
        ? { type: "card", cardNumber, cardHolderName: holderName, bankName: bankName || undefined }
        : { type: "sbp", sbpPhone: extractCleanPhone(sbpPhone)!, sbpBank, cardHolderName: holderName };
      const r = await fetch(`${API_BASE}/api/me/payout-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.issues?.[0]?.message ?? j.message ?? "Не удалось сохранить");
        setBusy(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Сетевая ошибка");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Добавить реквизиты для выплат</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setType("card")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
              type === "card" ? "border-primary bg-primary/5 text-primary" : "border-border text-stone-600"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Карта
          </button>
          <button
            onClick={() => setType("sbp")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
              type === "sbp" ? "border-primary bg-primary/5 text-primary" : "border-border text-stone-600"
            }`}
          >
            <Smartphone className="w-4 h-4" /> СБП
          </button>
        </div>

        <div className="space-y-3">
          {type === "card" ? (
            <>
              <div>
                <label className="block text-xs font-bold mb-1 text-muted-foreground">Номер карты</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 23))}
                  className="input-field w-full"
                  placeholder="0000 0000 0000 0000"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Сохраним только последние 4 цифры. Полный номер не хранится.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-muted-foreground">Банк (необязательно)</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Сбер, Тинькофф, Альфа..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold mb-1 text-muted-foreground">Телефон для СБП</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={sbpPhone}
                  onChange={e => setSbpPhone(formatPhoneMask(e.target.value))}
                  className="input-field w-full"
                  placeholder="+7 (9XX) XXX-XX-XX"
                  maxLength={18}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Только мобильный российский номер, привязанный к СБП.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-muted-foreground">Банк-получатель</label>
                <select
                  value={sbpBank}
                  onChange={e => setSbpBank(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">— выберите банк —</option>
                  {SBP_BANKS.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 text-muted-foreground">ФИО получателя</label>
            <input
              type="text"
              value={holderName}
              onChange={e => setHolderName(e.target.value)}
              className="input-field w-full"
              placeholder="Иванов Иван Иванович"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-stone-50"
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:bg-stone-300"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactsBalanceSection({ token }: { token: string }) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [data, setData] = useState<ContactBalanceData | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<null | "single" | "pack10" | "unlimited30d">(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/api/me/contact-balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/me/contact-unlocks`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bRes.ok) setData(await bRes.json());
      if (uRes.ok) {
        const u = await uRes.json();
        setUnlocks(Array.isArray(u.unlocks) ? u.unlocks : []);
      }
    } catch {
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => { reload(); }, [reload]);

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
        await reload();
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyKind(null);
    }
  };

  const kindLabel = (kind: string): string => {
    switch (kind) {
      case "bonus": return "Welcome-бонус";
      case "single": return "1 контакт";
      case "pack10": return "Пакет 10 контактов";
      case "unlimited30d": return "Безлимит 30 дней";
      default: return kind;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-border">
        <p className="text-muted-foreground">Не удалось загрузить баланс. Попробуйте обновить страницу.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full space-y-5">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-primary" /> Баланс контактов
      </h2>
      <p className="text-sm text-muted-foreground">
        Контакты позволяют открывать телефоны владельцев Free-объявлений напрямую,
        без оформления бронирования через Гарантийный фонд.
      </p>

      {/* ── Текущий баланс ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/5 via-white to-accent/5 border-2 border-primary/20 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {data.unlimitedActive ? <InfinityIcon className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">Доступно</p>
            {data.unlimitedActive ? (
              <>
                <p className="text-2xl font-display font-black">Безлимит</p>
                <p className="text-xs text-muted-foreground">
                  до {new Date(data.unlimitedUntil!).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-display font-black">{data.balance} <span className="text-base text-muted-foreground font-bold">шт.</span></p>
                {data.bonusGranted && (
                  <p className="text-[11px] text-amber-700 mt-0.5 inline-flex items-center gap-1">
                    <Gift className="w-3 h-3" /> Welcome-бонус начислен
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {data.contactLifetimeDays > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
            Каждый открытый контакт остаётся доступным {data.contactLifetimeDays} дней — повторное открытие бесплатно.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm">{error}</div>
      )}

      {/* ── Пополнение ─────────────────────────────────────────────── */}
      <div>
        <h3 className="font-bold text-base mb-3">Пополнить баланс</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <TopupCard
            title="1 контакт"
            subtitle="Разово"
            price={data.prices.single}
            busy={busyKind === "single"}
            onClick={() => topup("single")}
          />
          <TopupCard
            title="10 контактов"
            subtitle={`${Math.round(data.prices.pack10 / 10)} ₽ / шт`}
            price={data.prices.pack10}
            highlight
            busy={busyKind === "pack10"}
            onClick={() => topup("pack10")}
          />
          <TopupCard
            title="Безлимит 30 дней"
            subtitle="Без ограничений"
            price={data.prices.unlimited30d}
            busy={busyKind === "unlimited30d"}
            onClick={() => topup("unlimited30d")}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          MVP: пополнение мгновенное, оплата — заглушка. Реальная ЮKassa подключится отдельным этапом.
        </p>
      </div>

      {/* ── Открытые контакты ──────────────────────────────────────── */}
      {unlocks.length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-3">Открытые контакты ({unlocks.length})</h3>
          <div className="space-y-2">
            {unlocks.map(u => (
              <Link
                key={u.id}
                href={`/listings/${u.listingId}`}
                className="block bg-white border border-border rounded-xl p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">Объявление #{u.listingId}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Открыт {format(new Date(u.unlockedAt), "d MMM yyyy")}
                      {u.expiresAt && ` • до ${format(new Date(u.expiresAt), "d MMM yyyy")}`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    u.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {u.active ? "Активен" : "Истёк"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── История пополнений ─────────────────────────────────────── */}
      <div>
        <h3 className="font-bold text-base mb-3">История покупок</h3>
        {data.history.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-xl text-sm text-muted-foreground">
            Покупок пока нет
          </div>
        ) : (
          <div className="space-y-2">
            {data.history.map(h => (
              <div key={h.id} className="bg-white border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{kindLabel(h.kind)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(h.createdAt), "d MMM yyyy, HH:mm")}
                    {h.refundedAt && " • возвращено"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {h.amountRub > 0 ? (
                    <p className="font-bold text-sm">{formatPrice(h.amountRub)}</p>
                  ) : (
                    <p className="text-xs text-amber-700 font-semibold">Бесплатно</p>
                  )}
                  {h.contactsAdded > 0 && (
                    <p className="text-[11px] text-muted-foreground">+{h.contactsAdded} конт.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopupCard({
  title, subtitle, price, busy, onClick, highlight,
}: { title: string; subtitle: string; price: number; busy: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`text-left p-4 rounded-2xl border-2 transition-all disabled:opacity-50 ${
        highlight
          ? "border-primary bg-primary/5 hover:bg-primary/10"
          : "border-border bg-white hover:border-primary/40"
      }`}
    >
      <p className="font-bold text-sm">{title}</p>
      <p className="text-[11px] text-muted-foreground mb-2">{subtitle}</p>
      <div className="flex items-center justify-between">
        <span className="font-display font-black text-xl text-primary">{price} ₽</span>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
      </div>
    </button>
  );
}

// ─── Admin Account Panel — отдельная панель для администратора ────────────────
function AdminAccountPanel({
  user,
  avatarPreview,
  uploadingAvatar,
  onAvatarUpload,
  profileForm,
  setProfileForm,
  handleProfileSave,
  profileSaved,
  isSaving,
  authHeaders,
}: {
  user: any;
  avatarPreview: string | null;
  uploadingAvatar: boolean;
  onAvatarUpload: (f: File) => void;
  profileForm: any;
  setProfileForm: (fn: (f: any) => any) => void;
  handleProfileSave: (e: React.FormEvent) => Promise<void>;
  profileSaved: boolean;
  isSaving: boolean;
  authHeaders: Record<string, string>;
}) {
  const [, navigate] = useLocation();
  const [showSecurity, setShowSecurity] = useState(false);
  const [secForm, setSecForm] = useState({ currentPassword: "", newEmail: "", newPassword: "", confirmPassword: "" });
  const [secMsg, setSecMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [secSaving, setSecSaving] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL ?? "";

  async function handleSecuritySave(e: React.FormEvent) {
    e.preventDefault();
    setSecMsg(null);
    if (secForm.newPassword && secForm.newPassword !== secForm.confirmPassword) {
      setSecMsg({ type: "err", text: "Новый пароль и подтверждение не совпадают" });
      return;
    }
    if (!secForm.currentPassword) {
      setSecMsg({ type: "err", text: "Введите текущий пароль" });
      return;
    }
    setSecSaving(true);
    try {
      const body: any = { currentPassword: secForm.currentPassword };
      if (secForm.newEmail && secForm.newEmail !== user.email) body.newEmail = secForm.newEmail;
      if (secForm.newPassword) body.newPassword = secForm.newPassword;
      const r = await fetch(`${apiBase}/api/users/${user.id}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setSecMsg({ type: "err", text: data.message ?? "Не удалось обновить" });
      } else {
        setSecMsg({ type: "ok", text: "Доступы обновлены. Используйте новые данные при следующем входе." });
        setSecForm({ currentPassword: "", newEmail: "", newPassword: "", confirmPassword: "" });
      }
    } catch {
      setSecMsg({ type: "err", text: "Ошибка соединения" });
    } finally {
      setSecSaving(false);
    }
  }

  return (
    <div className="max-w-3xl w-full space-y-5">
      {/* Header — admin badge */}
      <div className="rounded-2xl border border-[#C65D3B]/30 bg-gradient-to-br from-[#C65D3B]/8 via-white to-amber-50 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          <div className="relative shrink-0 group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#C65D3B]/10 border-2 border-[#C65D3B]/30 flex items-center justify-center">
              {uploadingAvatar ? (
                <Loader2 className="w-8 h-8 animate-spin text-[#C65D3B]" />
              ) : (avatarPreview || user.avatar) ? (
                <img
                  src={avatarPreview || (user.avatar?.startsWith("http") ? user.avatar : `${apiBase}${user.avatar}`)}
                  className="w-full h-full object-cover"
                  alt={user.name}
                />
              ) : (
                <Shield className="w-10 h-10 text-[#C65D3B]" />
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-2xl transition-all cursor-pointer">
              <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && onAvatarUpload(e.target.files[0])} />
            </label>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C65D3B] text-white text-[11px] font-bold uppercase tracking-wider mb-2">
              <Shield className="w-3 h-3" /> {user.role === "superadmin" ? "Владелец платформы" : "Администратор платформы"}
            </div>
            <h2 className="text-2xl font-bold text-stone-900">{user.name}</h2>
            <p className="text-sm text-stone-600 mt-0.5">{user.email}</p>
            <p className="text-xs text-stone-500 mt-2 flex items-center gap-1.5 justify-center sm:justify-start">
              <CalendarDays className="w-3 h-3" />
              На платформе с {format(new Date(user.createdAt), "d MMMM yyyy")}
            </p>
            <p className="text-[11px] text-stone-400 mt-2">
              💡 Это служебный аккаунт. Профиль не показывается арендаторам и владельцам в каталоге.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links to admin panel */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#C65D3B]" /> Быстрый доступ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Админ-панель", icon: Shield, to: "/admin" },
            { label: "Денежные потоки", icon: Banknote, to: "/admin?tab=finance" },
            { label: "Аналитика", icon: BarChart2, to: "/admin?tab=analytics" },
            { label: "Журнал аудита", icon: ScrollText, to: "/admin?tab=audit" },
          ].map(l => (
            <button key={l.to} onClick={() => navigate(l.to)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-stone-200 hover:border-[#C65D3B]/40 hover:bg-stone-50 text-stone-700 hover:text-[#C65D3B] transition-all text-xs font-medium">
              <l.icon className="w-5 h-5" />
              <span className="leading-tight text-center">{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Personal contact info — minimal, only what matters for an admin */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-stone-800 mb-1 flex items-center gap-2">
          <User className="w-4 h-4 text-[#C65D3B]" /> Личные данные
        </h3>
        <p className="text-xs text-stone-500 mb-4">Используются для подписи сообщений в поддержке и связи с другими администраторами</p>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Отображаемое имя</label>
            <input type="text" required value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/40 focus:border-[#C65D3B] text-stone-800" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Контактный телефон</label>
            <div className="relative">
              <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="tel" value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+7 (999) 000-00-00"
                className="w-full pl-10 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/40 focus:border-[#C65D3B] text-stone-800" />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">Виден только другим администраторам</p>
          </div>

          <button type="submit" disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#C65D3B] hover:bg-[#A04A2D] text-white text-sm font-semibold transition disabled:opacity-50">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {profileSaved ? "✓ Сохранено" : "Сохранить"}
          </button>
        </form>
      </div>

      {/* Security — change email/password */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <button type="button" onClick={() => setShowSecurity(s => !s)}
          className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-800">Безопасность аккаунта</h3>
              <p className="text-xs text-stone-500">Смена email и пароля</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${showSecurity ? "rotate-90" : ""}`} />
        </button>

        {showSecurity && (
          <form onSubmit={handleSecuritySave} className="px-5 pb-5 pt-1 space-y-4 border-t border-stone-100">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
              ⚠️ Смена пароля разлогинит вас на других устройствах. Текущий пароль обязателен для подтверждения.
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Текущий пароль *</label>
              <input type="password" required value={secForm.currentPassword}
                onChange={e => setSecForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 text-stone-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Новый email</label>
                <input type="email" value={secForm.newEmail} placeholder={user.email}
                  onChange={e => setSecForm(f => ({ ...f, newEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 text-stone-800" />
              </div>
              <div className="hidden sm:block" />
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Новый пароль</label>
                <input type="password" minLength={6} value={secForm.newPassword}
                  onChange={e => setSecForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 text-stone-800" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Подтверждение</label>
                <input type="password" minLength={6} value={secForm.confirmPassword}
                  onChange={e => setSecForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 text-stone-800" />
              </div>
            </div>

            {secMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg ${
                secMsg.type === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"
              }`}>{secMsg.text}</div>
            )}

            <button type="submit" disabled={secSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition disabled:opacity-50">
              {secSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Обновить доступы
            </button>
          </form>
        )}
      </div>

      <div className="text-center pt-2">
        <button onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#C65D3B] hover:text-[#A04A2D] transition">
          Открыть полную админ-панель <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MyClaimsBlock — мои заявки в гарантийный фонд
// ════════════════════════════════════════════════════════════════════
type ClaimItem = {
  id: number;
  bookingId: number;
  type: "damage" | "theft";
  status: "pending" | "admin_review" | "approved" | "paid" | "rejected";
  description: string;
  evidenceUrl: string | null;
  adminNote: string | null;
  requestedAmount: string | null;
  approvedAmount: string | null;
  payoutToUserId: number | null;
  paymentRef: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

const CLAIM_STATUS_LABELS: Record<ClaimItem["status"], { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-amber-100 text-amber-800" },
  admin_review: { label: "Изучается админом", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Одобрена · ожидает выплаты", cls: "bg-blue-100 text-blue-800" },
  paid: { label: "Компенсация выплачена", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Отклонена", cls: "bg-rose-100 text-rose-800" },
};

const CLAIM_TYPE_LABELS: Record<ClaimItem["type"], string> = {
  damage: "Повреждение",
  theft: "Кража / невозврат",
};

function MyClaimsBlock({ token, reloadCounter }: { token: string; reloadCounter: number }) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [claims, setClaims] = useState<ClaimItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/claims/my`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("fail");
        const j = await r.json();
        if (!cancelled) setClaims(j);
      } catch {
        if (!cancelled) setClaims([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, API_BASE, reloadCounter]);

  if (!claims || claims.length === 0) return null;

  const active = claims.filter(c => c.status !== "rejected" && c.status !== "paid").length;
  const visible = expanded ? claims : claims.slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-rose-900">Мои заявки в фонд</h3>
          {active > 0 && (
            <span className="text-[10px] font-bold uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              {active} активных
            </span>
          )}
        </div>
        {claims.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-rose-700 hover:underline font-medium">
            {expanded ? "Свернуть" : `Показать все (${claims.length})`}
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {visible.map(c => {
          const st = CLAIM_STATUS_LABELS[c.status];
          return (
            <li key={c.id} className="bg-white border border-rose-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {CLAIM_TYPE_LABELS[c.type]}
                    <span className="text-muted-foreground font-normal"> · #{c.id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                </div>
                <div className="text-right shrink-0">
                  {c.approvedAmount && (
                    <p className="font-bold text-sm text-green-700">+{formatPrice(parseFloat(c.approvedAmount))}</p>
                  )}
                  {!c.approvedAmount && c.requestedAmount && (
                    <p className="text-sm text-muted-foreground">~{formatPrice(parseFloat(c.requestedAmount))}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(c.createdAt), "dd.MM.yy")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                {c.paymentRef && <span className="text-[10px] text-muted-foreground">Ref: <span className="font-mono">{c.paymentRef}</span></span>}
              </div>
              {c.rejectionReason && (
                <p className="text-xs text-rose-700 mt-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  <b>Причина отклонения:</b> {c.rejectionReason}
                </p>
              )}
              {c.adminNote && c.status !== "rejected" && (
                <p className="text-xs text-blue-700 mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <b>Комментарий администратора:</b> {c.adminNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SubmitClaimModal — модалка подачи заявки в фонд
// ════════════════════════════════════════════════════════════════════
function SubmitClaimModal({
  token,
  booking,
  onClose,
  onSuccess,
}: {
  token: string;
  booking: { id: number; bookingNumber?: string | null; listingTitle?: string | null; maxProtectionLimit?: number | null };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const [type, setType] = useState<"damage" | "theft">("damage");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicSettings = usePublicSettings();
  const isBetaMode = publicSettings?.isCommercialMode === false;

  const maxLimit = booking.maxProtectionLimit ? Number(booking.maxProtectionLimit) : 0;

  const handleSubmit = async () => {
    setError(null);
    if (description.trim().length < 10) {
      setError("Опишите ситуацию подробнее (не менее 10 символов).");
      return;
    }
    const amountNum = requestedAmount ? Number(requestedAmount.replace(/[^\d.]/g, "")) : null;
    if (amountNum != null && (!Number.isFinite(amountNum) || amountNum <= 0)) {
      setError("Сумма должна быть положительным числом.");
      return;
    }
    if (amountNum != null && maxLimit > 0 && amountNum > maxLimit) {
      setError(`Максимальная защита по объявлению — ${formatPrice(maxLimit)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bookingId: booking.id,
          type,
          description: description.trim(),
          evidenceUrl: evidenceUrl.trim() || null,
          requestedAmount: amountNum,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "Не удалось подать заявку");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Подать претензию
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {booking.bookingNumber ? `Бронирование № ${booking.bookingNumber}` : `Бронирование #${booking.id}`}
              {booking.listingTitle && ` · ${booking.listingTitle}`}
            </p>
            {maxLimit > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Лимит защиты: <b>{formatPrice(maxLimit)}</b>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stage 21b — баннер бета-режима в форме претензии. */}
          {isBetaMode && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 text-sm text-amber-900 flex gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
              <div className="leading-snug">
                <b>Обратите внимание:</b> в бета-режиме арбитраж работает на основе ваших Цифровых актов.
                Платформа поможет урегулировать спор, но <b>не производит денежных выплат</b> из фонда.
                Чем подробнее ваши фото и описание — тем выше шанс справедливого решения.
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Тип проблемы</label>
            <div className="grid grid-cols-2 gap-2">
              {(["damage", "theft"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    type === t ? "border-rose-500 bg-rose-50 text-rose-700" : "border-border hover:border-rose-300"
                  }`}
                >
                  {CLAIM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Что произошло <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Опишите ситуацию максимально подробно: когда обнаружили, какие повреждения / что пропало, контакт с другой стороной…"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{description.length} / 10+ символов</p>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Ссылка на доказательства <span className="text-muted-foreground">(фото / видео / переписка)</span>
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={e => setEvidenceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Запрашиваемая сумма, ₽ <span className="text-muted-foreground">(необязательно)</span>
            </label>
            <input
              type="number"
              min="1"
              max={maxLimit > 0 ? maxLimit : undefined}
              value={requestedAmount}
              onChange={e => setRequestedAmount(e.target.value)}
              placeholder={maxLimit > 0 ? `до ${maxLimit}` : "0"}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Окончательную сумму определит администратор после рассмотрения.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Заявка попадёт к администратору. Он свяжется с обеими сторонами и примет решение о выплате компенсации
              из гарантийного фонда. Будьте готовы предоставить дополнительные материалы.
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || description.trim().length < 10}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Отправить заявку
          </button>
        </div>
      </div>
    </div>
  );
}
