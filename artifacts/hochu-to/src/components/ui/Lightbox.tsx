import { useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface LightboxProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const prev = useCallback(() => {
    setIndex(i => (i - 1 + photos.length) % photos.length);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [photos.length]);

  const next = useCallback(() => {
    setIndex(i => (i + 1) % photos.length);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [photos.length]);

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 4));
  const zoomOut = () => {
    setScale(s => {
      const next = Math.max(s - 0.5, 1);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const API_BASE = import.meta.env.VITE_API_URL ?? "";
  const getPhotoSrc = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/70 text-sm font-medium">
          {photos.length > 1 ? `${index + 1} / ${photos.length}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 1}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-30"
            title="Уменьшить"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={scale >= 4}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-30"
            title="Увеличить"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors ml-2"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          key={index}
          src={getPhotoSrc(photos[index])}
          alt=""
          draggable={false}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          }}
          onError={e => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/800x600?text=Фото"; }}
        />

        {/* Prev / Next */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="shrink-0 flex gap-2 px-4 py-3 overflow-x-auto justify-center">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setScale(1); setOffset({ x: 0, y: 0 }); }}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img
                src={getPhotoSrc(url)}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/56x56?text="; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
