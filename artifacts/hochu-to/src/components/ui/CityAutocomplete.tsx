import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Справочник городов России (федеральные центры + крупные города)
const RU_CITIES: string[] = [
  "Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань",
  "Нижний Новгород","Челябинск","Самара","Омск","Ростов-на-Дону",
  "Уфа","Красноярск","Воронеж","Пермь","Волгоград","Краснодар",
  "Саратов","Тюмень","Тольятти","Ижевск","Барнаул","Ульяновск",
  "Иркутск","Хабаровск","Ярославль","Владивосток","Махачкала",
  "Томск","Оренбург","Кемерово","Новокузнецк","Рязань","Астрахань",
  "Набережные Челны","Пенза","Липецк","Тула","Киров","Чебоксары",
  "Калининград","Брянск","Курск","Иваново","Магнитогорск","Тверь",
  "Ставрополь","Нижний Тагил","Белгород","Архангельск","Владимир",
  "Сочи","Чита","Смоленск","Сургут","Волжский","Якутск","Орёл",
  "Улан-Удэ","Вологда","Саранск","Череповец","Тамбов","Симферополь",
  "Стерлитамак","Мурманск","Владикавказ","Нижневартовск","Петрозаводск",
  "Кострома","Нальчик","Новороссийск","Калуга","Грозный","Чебоксары",
  "Сыктывкар","Севастополь","Йошкар-Ола","Абакан","Псков","Великий Новгород",
  "Рыбинск","Балашиха","Химки","Подольск","Одинцово","Люберцы",
  "Мытищи","Красногорск","Королёв","Электросталь","Коломна","Раменское",
  "Серпухов","Жуковский","Ногинск","Орехово-Зуево","Домодедово",
  "Долгопрудный","Щёлково","Пушкино","Наро-Фоминск","Клин","Дмитров",
  "Воскресенск","Ступино","Можайск","Истра","Видное","Реутов",
  "Бийск","Рубцовск","Армавир","Пятигорск","Кисловодск","Ессентуки",
  "Таганрог","Шахты","Батайск","Новочеркасск","Волгодонск","Каменск-Шахтинский",
  "Тобольск","Ишим","Ханты-Мансийск","Нефтеюганск","Нягань",
  "Прокопьевск","Новокузнецк","Ленинск-Кузнецкий","Белово","Киселёвск",
  "Ачинск","Норильск","Канск","Минусинск","Железногорск",
  "Ангарск","Братск","Усть-Илимск","Шелехов","Саянск",
  "Комсомольск-на-Амуре","Амурск","Биробиджан",
  "Южно-Сахалинск","Петропавловск-Камчатский","Магадан","Анадырь",
  "Нарьян-Мар","Салехард","Новый Уренгой","Ноябрьск","Муравленко",
  "Ухта","Усинск","Воркута","Инта","Сыктывкар",
  "Великие Луки","Псков","Тихвин","Гатчина","Выборг","Сосновый Бор",
  "Петергоф","Колпино","Пушкин","Павловск","Кронштадт",
  "Нижний Новгород","Дзержинск","Арзамас","Саров","Бор","Кстово",
  "Оренбург","Орск","Новотроицк","Бузулук","Бугуруслан",
  "Пенза","Кузнецк","Заречный","Нижний Ломов",
  "Саратов","Балаково","Энгельс","Балашов","Вольск","Маркс",
  "Тольятти","Сызрань","Новокуйбышевск","Чапаевск","Кинель",
  "Ульяновск","Димитровград","Инза","Барыш","Сенгилей",
  "Казань","Набережные Челны","Альметьевск","Зеленодольск","Нижнекамск","Чистополь",
  "Уфа","Стерлитамак","Салават","Нефтекамск","Октябрьский","Туймазы","Белебей",
  "Пермь","Березники","Соликамск","Лысьва","Чайковский","Краснокамск",
  "Екатеринбург","Нижний Тагил","Каменск-Уральский","Первоуральск","Серов","Асбест",
  "Тюмень","Тобольск","Ишим","Ялуторовск","Заводоуковск",
  "Курган","Шадринск","Шумиха","Куртамыш",
  "Магнитогорск","Златоуст","Миасс","Копейск","Озёрск","Снежинск",
];

// Нормализация для нечёткого поиска
function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е");
}

function filterStatic(q: string, exclude: Set<string>): string[] {
  const nq = norm(q);
  const starts: string[] = [];
  const includes: string[] = [];
  for (const city of RU_CITIES) {
    if (exclude.has(city)) continue;
    const nc = norm(city);
    if (nc.startsWith(nq)) starts.push(city);
    else if (nc.includes(nq)) includes.push(city);
  }
  return [...starts, ...includes].slice(0, 6);
}

interface SuggestItem {
  name: string;
  hasListings: boolean;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Город...",
  className,
  inputClassName,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // Запрос к API (города с реальными объявлениями)
        let apiCities: string[] = [];
        try {
          const res = await fetch(`${API_BASE}/api/listings/cities?q=${encodeURIComponent(q)}`);
          if (res.ok) apiCities = await res.json();
        } catch { /* ignore network errors */ }

        if (cancelled) return;

        // Дополняем статическим справочником
        const apiSet = new Set(apiCities);
        const staticCities = filterStatic(q, apiSet);

        const items: SuggestItem[] = [
          ...apiCities.map(c => ({ name: c, hasListings: true })),
          ...staticCities.map(c => ({ name: c, hasListings: false })),
        ];

        setSuggestions(items.slice(0, 8));
        setShowDrop(items.length > 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  // Закрытие по клику вовне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = useCallback((city: string) => {
    onChange(city);
    setShowDrop(false);
    inputRef.current?.blur();
  }, [onChange]);

  const clear = useCallback(() => {
    onChange("");
    setSuggestions([]);
    setShowDrop(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Подсветка совпадения
  const highlight = (text: string, query: string) => {
    const idx = norm(text).indexOf(norm(query));
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <strong className="text-primary font-semibold">{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className={cn(
        "flex items-center gap-1.5 bg-white border rounded-xl px-3 transition-colors",
        value ? "border-primary" : "border-border",
        "focus-within:border-primary",
      )}>
        {loading
          ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          : <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDrop(true); }}
          onKeyDown={e => {
            if (e.key === "Escape") { setShowDrop(false); inputRef.current?.blur(); }
            if (e.key === "Enter" && suggestions.length > 0 && showDrop) {
              e.preventDefault();
              pick(suggestions[0].name);
            }
          }}
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-sm font-medium min-w-0 py-2.5",
            inputClassName,
          )}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDrop && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            <ul role="listbox" className="py-1">
              {suggestions.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={e => { e.preventDefault(); pick(item.name); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left text-sm"
                  >
                    <MapPin className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      item.hasListings ? "text-primary" : "text-muted-foreground",
                    )} />
                    <span className="flex-1 min-w-0">{highlight(item.name, value.trim())}</span>
                    {item.hasListings && (
                      <span className="text-[10px] font-semibold text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                        есть объявления
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
