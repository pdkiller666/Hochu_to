interface ListingPlaceholderProps {
  categoryName?: string;
  className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Инструменты": "🔧",
  "Электроника": "💻",
  "Транспорт": "🚲",
  "Туризм и кемпинг": "⛺",
  "Спорт": "⚽",
  "Детские товары": "🧸",
  "Праздник": "🎉",
  "Дом и сад": "🌱",
  "Одежда": "👕",
  "Другое": "📦",
};

const GRADIENTS = [
  "from-orange-100 to-amber-200",
  "from-teal-100 to-cyan-200",
  "from-violet-100 to-purple-200",
  "from-rose-100 to-pink-200",
  "from-lime-100 to-green-200",
  "from-sky-100 to-blue-200",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ListingPlaceholder({ categoryName, className = "" }: ListingPlaceholderProps) {
  const icon = (categoryName && CATEGORY_ICONS[categoryName]) || "📦";
  const gradient = GRADIENTS[hashStr(categoryName || "default") % GRADIENTS.length];

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${gradient} ${className}`}>
      <span className="text-5xl mb-2 select-none" role="img">{icon}</span>
      <span className="text-xs font-medium text-gray-500 select-none">Нет фото</span>
    </div>
  );
}
