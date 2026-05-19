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

export function Ticker() {
  const repeated = [...items, ...items];
  return (
    <div className="bg-[#2B2B2B] py-4 overflow-hidden select-none">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{
          animation: "ticker 40s linear infinite",
          width: "max-content",
        }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            className="text-sm font-semibold text-white/80 flex-shrink-0 flex items-center gap-2"
          >
            {item}
            <span className="text-[#C65D3B] text-lg mx-3">·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
