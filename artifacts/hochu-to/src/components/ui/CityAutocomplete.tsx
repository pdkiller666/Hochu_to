import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions with 250ms debounce
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/listings/cities?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: string[] = await res.json();
        if (!cancelled) {
          setSuggestions(data);
          setShowDrop(data.length > 0);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  // Close on outside click
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

  // Highlight matching part
  const highlight = (text: string, query: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
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
              pick(suggestions[0]);
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
              {suggestions.map((city) => (
                <li key={city}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={e => { e.preventDefault(); pick(city); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left text-sm"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span>{highlight(city, value.trim())}</span>
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
