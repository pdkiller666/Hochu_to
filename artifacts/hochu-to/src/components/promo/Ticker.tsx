import { useState } from "react";

const items = [
  "🛡️ Цифровой акт на каждую сделку",
  "📸 Минимум 4 фото при передаче",
  "🤝 Гарантийный фонд взаимопомощи",
  "⚡ P2P-переводы через СБП",
  "🤖 AI-арбитраж при спорах",
  "🌟 Рейтинг доверия 0–100",
  "📍 GPS-метки в актах передачи",
  "🔒 Электронная подпись сторон",
  "💎 Совместная покупка вещей мечты",
  "✅ Работает прямо сейчас — не в планах",
];

const repeated = [...items, ...items];

export function Ticker() {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="bg-[#2B2B2B] py-4 overflow-hidden select-none cursor-default"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        style={{
          display: "flex",
          gap: "3rem",
          whiteSpace: "nowrap",
          width: "max-content",
          animation: "hochu-ticker 38s linear infinite",
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
            className="text-sm font-semibold text-white/80"
          >
            {item}
            <span className="text-[#C65D3B] text-lg mx-3">·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes hochu-ticker {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
