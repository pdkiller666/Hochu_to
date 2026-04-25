import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

interface Props {
  height?: number;
  disabled?: boolean;
  onChange?: (empty: boolean) => void;
}

/**
 * Stage 22b — холст для рисования подписи.
 *
 * Native HTML5 canvas + Pointer Events (универсально для мыши, пальца, стилуса).
 * Адаптивный по ширине: на каждый resize пересоздаём bitmap с devicePixelRatio
 * для чёткой линии на ретине. Снимок отдаётся как data:image/png;base64
 * через ref-метод toDataURL (минимизируем ререндеры).
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 180, disabled = false, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  function getCtx(): CanvasRenderingContext2D | null {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }

  function resize() {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = height;
    // Сохраняем текущее изображение перед resize, чтобы не терять подпись.
    const snapshot = dirtyRef.current ? canvas.toDataURL("image/png") : null;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = getCtx();
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#1a1a1a";
      if (snapshot) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
        img.src = snapshot;
      }
    }
  }

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    lastPointRef.current = pointFromEvent(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastPointRef.current) return;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setEmpty(false);
      onChange?.(false);
    }
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    lastPointRef.current = null;
  }

  function clear() {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(dpr, dpr);
    dirtyRef.current = false;
    setEmpty(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => !dirtyRef.current,
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
  }));

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative rounded-xl border-2 border-dashed border-stone-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="block w-full select-none touch-none cursor-crosshair"
          style={{ height }}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-stone-300 text-sm">
            Распишитесь здесь пальцем или мышью
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">
          Подпись фиксирует ваше согласие с состоянием вещи на момент акта.
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || empty}
          className="text-[11px] text-stone-600 hover:text-rose-600 disabled:opacity-40 flex items-center gap-1"
        >
          <Eraser className="w-3 h-3" /> Очистить
        </button>
      </div>
    </div>
  );
});
