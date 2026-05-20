import { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2, Camera, X, MapPin, Clock, ShieldCheck, AlertTriangle,
  PenLine, Video, Upload, Maximize2, Info, CheckCircle2, UserCheck,
  ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";
// @ts-expect-error — exifr — pure JS, no bundled .d.ts
import exifr from "exifr";
import { getToken } from "@/lib/auth";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 10;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type DigitalActKind = "check_in" | "check_out" | "pool_handover";

interface UploadedPhoto {
  url: string;
  exif?: { lat?: number; lng?: number; takenAt?: string; fromBrowserGeo?: boolean };
}

interface Props {
  bookingId?: number;
  poolId?: number;
  type: DigitalActKind;
  toUserId?: number;
  toUserName?: string;
  /**
   * Роль текущего пользователя в сделке.
   * check_in → первичный подписант owner.
   * check_out → первичный подписант renter.
   */
  userRole?: "owner" | "renter";
  /** ID текущего пользователя — нужен для определения режима (кто уже подписал). */
  currentUserId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

type ActMode = "loading" | "full" | "countersign" | "already_signed" | "already_countersigned";

export function DigitalActUpload({
  bookingId, poolId, type, toUserId, toUserName, userRole, currentUserId, onClose, onSuccess,
}: Props) {
  if ((bookingId == null) === (poolId == null)) {
    throw new Error("DigitalActUpload: укажите ровно один из bookingId / poolId");
  }
  if (type === "pool_handover") {
    if (poolId == null) throw new Error("DigitalActUpload: для type='pool_handover' нужен poolId");
    if (toUserId == null) throw new Error("DigitalActUpload: для type='pool_handover' нужен toUserId");
  }

  const endpoint = type === "pool_handover"
    ? `/api/pools/${poolId}/handovers`
    : bookingId != null
      ? `/api/bookings/${bookingId}/digital-acts`
      : `/api/pools/${poolId}/digital-acts`;

  const [actMode, setActMode] = useState<ActMode>(bookingId != null && currentUserId != null ? "loading" : "full");
  const [existingAct, setExistingAct] = useState<any>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoIsInternal, setVideoIsInternal] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [fsOpen, setFsOpen] = useState(false);
  const [fsEmpty, setFsEmpty] = useState(true);
  const [browserGpsUsed, setBrowserGpsUsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<SignaturePadHandle>(null);
  const fsSignatureRef = useRef<SignaturePadHandle>(null);

  // ─── Проверяем существующий акт при открытии ────────────────────────────────
  useEffect(() => {
    if (bookingId == null || currentUserId == null || type === "pool_handover") {
      setActMode("full");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/bookings/${bookingId}/digital-acts`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!r.ok) { setActMode("full"); return; }
        const { items } = await r.json() as { items: any[] };
        const act = items?.find((a) => a.type === type);
        if (!act) {
          setActMode("full");
          return;
        }
        setExistingAct(act);
        const hasCountersign = !!(act.metadata?.counterSignature);
        if (act.createdByUserId === currentUserId) {
          setActMode(hasCountersign ? "already_countersigned" : "already_signed");
        } else {
          setActMode(hasCountersign ? "already_countersigned" : "countersign");
        }
      } catch {
        setActMode("full");
      }
    })();
  }, [bookingId, type, currentUserId]);

  const title = type === "check_in"
    ? "Цифровой акт приёмки"
    : type === "check_out"
      ? "Цифровой акт возврата"
      : "Передача вещи Хранителю";

  const subtitle = type === "check_in"
    ? "Сфотографируйте вещь до начала аренды (4+ ракурса). Это защитит вас при споре."
    : type === "check_out"
      ? "Зафиксируйте состояние вещи в момент возврата."
      : `Сфотографируйте вещь в момент передачи${toUserName ? ` пользователю ${toUserName}` : ""} (4+ ракурса).`;

  const expectedSigner: "owner" | "renter" | null =
    type === "check_in" ? "owner" :
    type === "check_out" ? "renter" :
    null;

  const isWrongParty = expectedSigner !== null && userRole !== undefined && userRole !== expectedSigner;
  const signerLabel = expectedSigner === "owner" ? "владелец" : expectedSigner === "renter" ? "арендатор" : "";

  // ─── Получение GPS из браузера как fallback ──────────────────────────────────
  async function getBrowserGps(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 6000, maximumAge: 60_000 },
      );
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      arr.forEach(f => formData.append("photos", f));

      // 1) Пробуем извлечь EXIF GPS из файлов
      const exifResults = await Promise.all(
        arr.map(async (f) => {
          try {
            const data = await exifr.parse(f, { gps: true, pick: ["DateTimeOriginal", "latitude", "longitude"] });
            return {
              lat: typeof data?.latitude === "number" ? data.latitude : undefined,
              lng: typeof data?.longitude === "number" ? data.longitude : undefined,
              takenAt: data?.DateTimeOriginal ? new Date(data.DateTimeOriginal).toISOString() : undefined,
            };
          } catch { return {}; }
        })
      );

      // 2) Если ни у одного файла нет GPS — запрашиваем через браузер
      const hasExifGps = exifResults.some(e => e.lat && e.lng);
      let browserGps: { lat: number; lng: number } | null = null;
      if (!hasExifGps) {
        browserGps = await getBrowserGps();
        if (browserGps) setBrowserGpsUsed(true);
      }

      // 3) Применяем браузерный GPS ко всем фото, у которых нет EXIF GPS
      const finalExif = exifResults.map(e =>
        e.lat ? e : (browserGps ? { ...e, lat: browserGps.lat, lng: browserGps.lng, fromBrowserGeo: true } : e)
      );

      const r = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!r.ok) throw new Error("Не удалось загрузить фото");
      const { urls } = await r.json() as { urls: string[] };
      setPhotos(prev => [...prev, ...urls.map((url, i) => ({ url, exif: finalExif[i] }))]);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Видео слишком большое (${Math.round(file.size / 1024 / 1024)}МБ). Лимит — 100МБ.`);
      return;
    }
    setVideoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const r = await fetch(`${API_BASE}/api/upload-video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "Не удалось загрузить видео");
      }
      const { url } = await r.json() as { url: string };
      setVideoUrl(url);
      setVideoIsInternal(true);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки видео");
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  function clearVideo() {
    setVideoUrl("");
    setVideoIsInternal(false);
  }

  function acceptFullscreenSignature() {
    if (fsSignatureRef.current && !fsSignatureRef.current.isEmpty()) {
      const dataUrl = fsSignatureRef.current.toDataURL();
      if (signatureRef.current) {
        signatureRef.current.loadDataURL(dataUrl);
      }
      setSignatureEmpty(false);
    }
    setFsOpen(false);
  }

  // ─── Основная подпись (первая сторона) ──────────────────────────────────────
  async function submit() {
    if (videoUploading) { setError("Дождитесь окончания загрузки видео."); return; }
    if (photos.length < MIN_PHOTOS) { setError(`Минимум ${MIN_PHOTOS} фото — у вас ${photos.length}.`); return; }
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError("Поставьте подпись — это обязательное условие акта.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signature = signatureRef.current.toDataURL();
      const photosWithGps = photos.filter(p => p.exif?.lat && p.exif?.lng).length;
      const metadata = {
        extractedFromExif: photosWithGps > 0,
        photoExif: photos.map(p => p.exif),
        userAgent: navigator.userAgent,
        clientTimestamp: new Date().toISOString(),
        signature,
      };
      const body = type === "pool_handover"
        ? { toUserId, photos: photos.map(p => p.url), videoUrl: videoUrl.trim() || null, metadata }
        : { type, photos: photos.map(p => p.url), videoUrl: videoUrl.trim() || null, metadata };

      const r = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        // Если акт уже существует — перезагружаем состояние компонента
        if (j.error === "act_already_exists") {
          setActMode("loading");
          const rActs = await fetch(`${API_BASE}/api/bookings/${bookingId}/digital-acts`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (rActs.ok) {
            const { items } = await rActs.json() as { items: any[] };
            const act = items?.find((a) => a.type === type);
            if (act) {
              setExistingAct(act);
              const hasCountersign = !!(act.metadata?.counterSignature);
              setActMode(act.createdByUserId === currentUserId
                ? (hasCountersign ? "already_countersigned" : "already_signed")
                : (hasCountersign ? "already_countersigned" : "countersign"));
              setBusy(false);
              return;
            }
          }
        }
        throw new Error(j.message || "Не удалось сохранить акт");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  // ─── Контрподпись (вторая сторона) ──────────────────────────────────────────
  async function submitCountersign() {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError("Поставьте подпись для подтверждения акта.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signature = signatureRef.current.toDataURL();
      const r = await fetch(
        `${API_BASE}/api/bookings/${bookingId}/digital-acts/${existingAct.id}/countersign`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ signature }),
        }
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "Не удалось сохранить подпись");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const photosWithGps = photos.filter(p => p.exif?.lat && p.exif?.lng).length;
  const canSubmit = !isWrongParty && photos.length >= MIN_PHOTOS && !signatureEmpty && !busy && !videoUploading;

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (actMode === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Проверяем акт…</p>
        </div>
      </div>
    );
  }

  // ─── Обе стороны уже подписали ──────────────────────────────────────────────
  if (actMode === "already_countersigned") {
    const actTypeLabel = type === "check_in" ? "приёмки" : "возврата";
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          <h3 className="text-lg font-bold">Акт {actTypeLabel} подписан обеими сторонами</h3>
          <p className="text-sm text-muted-foreground">
            Обе стороны поставили подпись. Документ зафиксирован и является основой для арбитража.
          </p>
          <button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold">
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  // ─── Текущий пользователь уже подписал, ждём вторую сторону ─────────────────
  if (actMode === "already_signed") {
    const actTypeLabel = type === "check_in" ? "приёмки" : "возврата";
    const waitingFor = type === "check_in" ? "арендатора" : "владельца";
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-8 flex flex-col items-center gap-4 text-center">
          <UserCheck className="w-14 h-14 text-amber-500" />
          <h3 className="text-lg font-bold">Вы уже подписали акт {actTypeLabel}</h3>
          <p className="text-sm text-muted-foreground">
            Ожидается подпись <b>{waitingFor}</b>. Он получил уведомление и может подписать акт в своём личном кабинете.
          </p>
          <button onClick={onClose} className="w-full py-3 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold">
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  // ─── Режим контрподписи (вторая сторона подписывает) ────────────────────────
  if (actMode === "countersign") {
    const actTypeLabel = type === "check_in" ? "приёмки" : "возврата";
    const firstSignerLabel = type === "check_in" ? "Владелец" : "Арендатор";
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" /> Подтвердите акт {actTypeLabel}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {firstSignerLabel} уже подписал акт. Поставьте свою подпись для завершения.
                </p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg" aria-label="Закрыть">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Фото из акта (только просмотр) */}
              {existingAct?.photos?.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    📷 Фото из акта ({existingAct.photos.length} шт.)
                    <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">— нажмите для просмотра</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {existingAct.photos.map((url: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightboxIdx(i)}
                        className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 group focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <img
                          src={url.startsWith("http") ? url : `${API_BASE}${url}`}
                          alt={`Фото ${i + 1}`}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                        <div className="absolute bottom-1 right-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded font-medium">
                          {i + 1}/{existingAct.photos.length}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Лайтбокс */}
              {lightboxIdx !== null && existingAct?.photos && (
                <div
                  className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
                  onClick={() => setLightboxIdx(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setLightboxIdx(null);
                    if (e.key === "ArrowLeft") setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i);
                    if (e.key === "ArrowRight") setLightboxIdx(i => i !== null && i < existingAct.photos.length - 1 ? i + 1 : i);
                  }}
                  tabIndex={-1}
                  ref={el => el?.focus()}
                >
                  {/* Закрыть */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
                    className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Счётчик */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
                    {lightboxIdx + 1} / {existingAct.photos.length}
                  </div>

                  {/* Стрелка влево */}
                  {lightboxIdx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
                      className="absolute left-3 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}

                  {/* Фото */}
                  <img
                    src={existingAct.photos[lightboxIdx].startsWith("http") ? existingAct.photos[lightboxIdx] : `${API_BASE}${existingAct.photos[lightboxIdx]}`}
                    alt={`Фото ${lightboxIdx + 1}`}
                    className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Стрелка вправо */}
                  {lightboxIdx < existingAct.photos.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
                      className="absolute right-3 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}

                  {/* Точки-навигация */}
                  {existingAct.photos.length > 1 && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {existingAct.photos.map((_: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                          className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIdx ? "bg-white" : "bg-white/30 hover:bg-white/60"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Проверьте состояние вещи</p>
                  <p className="text-xs mt-0.5 text-amber-700">
                    Просмотрите фотографии выше. Если согласны с зафиксированным состоянием — поставьте подпись.
                  </p>
                </div>
              </div>

              {/* Подпись */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <PenLine className="w-3.5 h-3.5" />
                    Ваша подпись <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setFsEmpty(true); setFsOpen(true); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    На весь экран
                  </button>
                </div>
                <SignaturePad ref={signatureRef} onChange={(emp) => setSignatureEmpty(emp)} />
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex gap-3">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                Отмена
              </button>
              <button
                onClick={submitCountersign}
                disabled={signatureEmpty || busy}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Подтвердить акт
              </button>
            </div>
          </div>
        </div>

        {fsOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-bold text-base flex items-center gap-2">
                <PenLine className="w-4 h-4 text-emerald-600" />
                Распишитесь пальцем
              </span>
              <button onClick={() => setFsOpen(false)} className="p-1.5 hover:bg-stone-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col p-4 gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Проведите пальцем или мышью по белому полю, чтобы поставить подпись
              </p>
              <div className="flex-1 min-h-0">
                <SignaturePad
                  ref={fsSignatureRef}
                  height={Math.max(260, window.innerHeight - 220)}
                  onChange={(emp) => setFsEmpty(emp)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button onClick={() => setFsOpen(false)}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors">
                Отмена
              </button>
              <button
                onClick={acceptFullscreenSignature}
                disabled={fsEmpty}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                Принять подпись
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ─── Полный режим (первая сторона — новый акт) ───────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
          <div className="p-6 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> {title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg" aria-label="Закрыть">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {isWrongParty && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Этот акт подписывает {signerLabel}</p>
                  <p className="text-xs mt-0.5 text-amber-700">Дождитесь подписи второй стороны или свяжитесь с ней в чате.</p>
                </div>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Цифровой акт — ваша основная защита при споре. Фотографируйте с разных ракурсов,
                включая мелкие повреждения, царапины, серийные номера.
                <b> GPS и время съёмки</b> извлекаются автоматически из фото или браузерной геолокации.
              </div>
            </div>

            {/* Фото */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
                Фото вещи <span className="text-rose-600">*</span>{" "}
                <span className="text-muted-foreground">(минимум {MIN_PHOTOS}, до {MAX_PHOTOS})</span>
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border-2 border-emerald-200 bg-stone-100">
                    <img src={`${API_BASE}${p.url}`} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1">
                      <X className="w-3 h-3" />
                    </button>
                    {(p.exif?.lat || p.exif?.takenAt) && (
                      <div className={`absolute bottom-0 inset-x-0 text-white text-[9px] py-0.5 px-1 flex items-center gap-1 ${p.exif.fromBrowserGeo ? "bg-blue-700/90" : "bg-emerald-700/90"}`}>
                        {p.exif.lat && <MapPin className="w-2.5 h-2.5" />}
                        {p.exif.takenAt && <Clock className="w-2.5 h-2.5" />}
                        <span>
                          {p.exif.lat ? (p.exif.fromBrowserGeo ? "Геолок." : "GPS") : ""}
                          {p.exif.lat && p.exif.takenAt ? " • " : ""}
                          {p.exif.takenAt ? "EXIF" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                    className="aspect-square rounded-lg border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors disabled:opacity-50">
                    {busy
                      ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                      : <Camera className="w-6 h-6 text-emerald-600" />}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
                className="hidden" onChange={e => handleFiles(e.target.files)} />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{photos.length} / {MIN_PHOTOS}+ загружено</span>
                {photos.length > 0 && (
                  <span>{photosWithGps > 0
                    ? `📍 GPS у ${photosWithGps} из ${photos.length}${browserGpsUsed ? " (браузер)" : ""}`
                    : "ℹ️ GPS не найден — геопривязка добавится при наличии разрешения"}</span>
                )}
              </div>
            </div>

            {/* Видео */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
                Видео <span className="text-muted-foreground">(необязательно)</span>
              </label>
              {videoIsInternal && videoUrl ? (
                <div className="rounded-xl border-2 border-emerald-200 bg-stone-50 p-2 space-y-2">
                  <video src={`${API_BASE}${videoUrl}`} controls className="w-full rounded-lg max-h-48 bg-black" />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Video className="w-3 h-3" /> Видео загружено
                    </span>
                    <button type="button" onClick={clearVideo} className="text-rose-600 hover:underline">Удалить</button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={e => { setVideoUrl(e.target.value); setVideoIsInternal(false); }}
                    placeholder="https://… (YouTube, Я.Диск, Облако Mail)"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    disabled={videoUploading}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-px bg-stone-200" />
                    <span className="text-[10px] uppercase tracking-wide text-stone-400">или</span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={videoUploading}
                    className="mt-2 w-full py-2 border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 rounded-xl text-sm font-medium text-emerald-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {videoUploading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Загружаю видео…</>
                      : <><Upload className="w-4 h-4" /> Загрузить видео-файл (MP4/MOV/WebM, до 100МБ)</>}
                  </button>
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime"
                    className="hidden" onChange={e => handleVideoFile(e.target.files)} />
                </>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Покажите работоспособность вещи (включение, основные функции).
                {videoIsInternal ? " Видео хранится на платформе и доступно админу при споре." : ""}
              </p>
            </div>

            {/* Подпись */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5" />
                  Подпись <span className="text-rose-600">*</span>
                  <span className="text-muted-foreground normal-case font-normal">— подтверждение акта</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setFsEmpty(true); setFsOpen(true); }}
                  disabled={isWrongParty}
                  title="Развернуть подпись на весь экран"
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  На весь экран
                </button>
              </div>
              <div className={isWrongParty ? "opacity-40 pointer-events-none" : ""}>
                <SignaturePad ref={signatureRef} onChange={(emp) => setSignatureEmpty(emp)} />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border space-y-2">
            {!isWrongParty && (photos.length < MIN_PHOTOS || signatureEmpty) && !busy && (
              <p role="status" aria-live="polite" className="text-xs text-stone-500 text-center">
                {photos.length < MIN_PHOTOS && signatureEmpty
                  ? `Добавьте ещё ${MIN_PHOTOS - photos.length} фото и подпись`
                  : photos.length < MIN_PHOTOS
                    ? `Добавьте ещё ${MIN_PHOTOS - photos.length} фото`
                    : "Добавьте подпись для сохранения акта"}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                Отмена
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                title={isWrongParty ? `Этот акт подписывает ${signerLabel}` : undefined}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Сохранить акт
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Полноэкранный режим подписи */}
      {fsOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-bold text-base flex items-center gap-2">
              <PenLine className="w-4 h-4 text-emerald-600" />
              Распишитесь пальцем
            </span>
            <button onClick={() => setFsOpen(false)} className="p-1.5 hover:bg-stone-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col p-4 gap-4">
            <p className="text-sm text-muted-foreground text-center">
              Проведите пальцем или мышью по белому полю, чтобы поставить подпись
            </p>
            <div className="flex-1 min-h-0">
              <SignaturePad
                ref={fsSignatureRef}
                height={Math.max(260, window.innerHeight - 220)}
                onChange={(emp) => setFsEmpty(emp)}
              />
            </div>
          </div>
          <div className="p-4 border-t border-border flex gap-3">
            <button onClick={() => setFsOpen(false)}
              className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-colors">
              Отмена
            </button>
            <button
              onClick={acceptFullscreenSignature}
              disabled={fsEmpty}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              Принять подпись
            </button>
          </div>
        </div>
      )}
    </>
  );
}
