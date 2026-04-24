import { useState, useRef } from "react";
import { Loader2, Camera, X, MapPin, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
// @ts-expect-error — exifr — pure JS, no bundled .d.ts
import exifr from "exifr";
import { getToken } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 10;

export type DigitalActKind = "check_in" | "check_out";

interface UploadedPhoto {
  url: string;
  exif?: { lat?: number; lng?: number; takenAt?: string };
}

interface Props {
  bookingId: number;
  type: DigitalActKind;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Stage 22a — Цифровой Акт. Загрузка минимум 4 фото вещи + извлечение EXIF
 * (GPS, дата съёмки) на клиенте, чтобы зафиксировать состояние перед/после
 * передачи. Отправляет:
 *   1) фото на /api/upload (получает /uploads/<uuid>.jpg)
 *   2) сам акт на /api/bookings/:id/digital-acts с photos[] и metadata.
 *
 * EXIF может быть удалён при экспорте из мессенджеров — graceful fallback
 * (фото примем без GPS, но в админке это будет видно).
 */
export function DigitalActUpload({ bookingId, type, onClose, onSuccess }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = type === "check_in" ? "Цифровой акт приёмки" : "Цифровой акт возврата";
  const subtitle = type === "check_in"
    ? "Сфотографируйте вещь до начала аренды (4+ ракурса). Это защитит вас при споре."
    : "Зафиксируйте состояние вещи в момент возврата.";

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (arr.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      // Параллельно: грузим в multer + парсим EXIF на клиенте
      const formData = new FormData();
      arr.forEach(f => formData.append("photos", f));

      const exifResults = await Promise.all(
        arr.map(async (f) => {
          try {
            const data = await exifr.parse(f, { gps: true, pick: ["DateTimeOriginal", "latitude", "longitude"] });
            return {
              lat: typeof data?.latitude === "number" ? data.latitude : undefined,
              lng: typeof data?.longitude === "number" ? data.longitude : undefined,
              takenAt: data?.DateTimeOriginal ? new Date(data.DateTimeOriginal).toISOString() : undefined,
            };
          } catch {
            return {};
          }
        })
      );

      const r = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!r.ok) throw new Error("Не удалось загрузить фото");
      const { urls } = await r.json() as { urls: string[] };

      const next = urls.map((url, i) => ({ url, exif: exifResults[i] }));
      setPhotos(prev => [...prev, ...next]);
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

  async function submit() {
    if (photos.length < MIN_PHOTOS) {
      setError(`Минимум ${MIN_PHOTOS} фото — у вас ${photos.length}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photosWithGps = photos.filter(p => p.exif?.lat && p.exif?.lng).length;
      const metadata = {
        extractedFromExif: photosWithGps > 0,
        photoExif: photos.map(p => p.exif),
        userAgent: navigator.userAgent,
        clientTimestamp: new Date().toISOString(),
      };

      const r = await fetch(`${API_BASE}/api/bookings/${bookingId}/digital-acts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          type,
          photos: photos.map(p => p.url),
          videoUrl: videoUrl.trim() || null,
          metadata,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "Не удалось сохранить акт");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const photosWithGps = photos.filter(p => p.exif?.lat && p.exif?.lng).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Цифровой акт — ваша основная защита при споре. Фотографируйте с разных ракурсов,
              включая мелкие повреждения, царапины, серийные номера.
              <b> GPS и время съёмки</b> извлекаются автоматически (если не отключены в камере).
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Фото вещи <span className="text-rose-600">*</span> <span className="text-muted-foreground">(минимум {MIN_PHOTOS}, до {MAX_PHOTOS})</span>
            </label>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border-2 border-emerald-200 bg-stone-100">
                  <img src={`${API_BASE}${p.url}`} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
                          aria-label="Удалить фото">
                    <X className="w-3 h-3" />
                  </button>
                  {(p.exif?.lat || p.exif?.takenAt) && (
                    <div className="absolute bottom-0 inset-x-0 bg-emerald-700/90 text-white text-[9px] py-0.5 px-1 flex items-center gap-1">
                      {p.exif.lat && <MapPin className="w-2.5 h-2.5" />}
                      {p.exif.takenAt && <Clock className="w-2.5 h-2.5" />}
                      <span>{p.exif.lat ? "GPS" : ""}{p.exif.lat && p.exif.takenAt ? " • " : ""}{p.exif.takenAt ? "EXIF" : ""}</span>
                    </div>
                  )}
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="aspect-square rounded-lg border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
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
                  ? `📍 GPS у ${photosWithGps} из ${photos.length}`
                  : "⚠️ GPS не извлечён (нормально для скриншотов)"}</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
              Видео <span className="text-muted-foreground">(необязательно — ссылка)</span>
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://… (YouTube, Я.Диск, Облако Mail)"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Покажите работоспособность вещи (включение, основные функции).
            </p>
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
          <button onClick={submit} disabled={busy || photos.length < MIN_PHOTOS}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Сохранить акт
          </button>
        </div>
      </div>
    </div>
  );
}
