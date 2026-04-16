import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths,
  isSameDay, isSameMonth, isAfter, isBefore, isToday,
  format, parseISO,
} from "date-fns";
import { ru } from "date-fns/locale";

export type BookedRange = {
  startDate: string;
  endDate: string;
  status: "confirmed" | "pending";
};

type Props = {
  bookedRanges: BookedRange[];
  startDate: string;
  endDate: string;
  onSelect: (date: string) => void;
};

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function BookingCalendar({ bookedRanges, startDate, endDate, onSelect }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Expand booking ranges to individual day map: "yyyy-MM-dd" -> "confirmed" | "pending"
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, "confirmed" | "pending">();
    for (const range of bookedRanges) {
      let d = parseISO(range.startDate);
      const end = parseISO(range.endDate);
      while (d <= end) {
        const key = format(d, "yyyy-MM-dd");
        // confirmed overwrites pending (higher priority)
        if (!map.has(key) || range.status === "confirmed") {
          map.set(key, range.status);
        }
        d = addDays(d, 1);
      }
    }
    return map;
  }, [bookedRanges]);

  // Build calendar grid (Mon–Sun weeks)
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const result: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [currentMonth]);

  const startObj = startDate ? parseISO(startDate) : null;
  const endObj = endDate ? parseISO(endDate) : null;

  const getDayState = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    const inCurrentMonth = isSameMonth(d, currentMonth);
    const isPast = isBefore(d, today);
    const bookingStatus = dateStatusMap.get(key);

    const isStart = startObj && isSameDay(d, startObj);
    const isEnd = endObj && isSameDay(d, endObj);
    const isInRange =
      startObj && endObj && isAfter(d, startObj) && isBefore(d, endObj);

    return { inCurrentMonth, isPast, bookingStatus, isStart, isEnd, isInRange };
  };

  const handleDayClick = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    const isPast = isBefore(d, today);
    const bookingStatus = dateStatusMap.get(key);
    if (isPast || bookingStatus === "confirmed") return;
    onSelect(key);
  };

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-sm capitalize">
          {format(currentMonth, "LLLL yyyy", { locale: ru })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(wd => (
          <div key={wd} className="text-center text-[11px] font-bold text-muted-foreground py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map(d => {
          const { inCurrentMonth, isPast, bookingStatus, isStart, isEnd, isInRange } = getDayState(d);

          if (!inCurrentMonth) {
            return <div key={d.toISOString()} className="h-9" />;
          }

          let cellClass = "relative h-9 flex flex-col items-center justify-center text-sm rounded-xl transition-colors ";
          let dotColor = "";

          if (isPast) {
            cellClass += "text-muted-foreground/30 cursor-default";
          } else if (bookingStatus === "confirmed") {
            // Red — fully booked
            cellClass += "bg-red-100 text-red-400 cursor-not-allowed";
            dotColor = "bg-red-400";
          } else if (bookingStatus === "pending") {
            // Amber — soft reserve (pending)
            cellClass += "bg-amber-50 text-amber-600 cursor-not-allowed";
            dotColor = "bg-amber-400";
          } else if (isStart || isEnd) {
            // User's selected start/end
            cellClass += "bg-primary text-white font-bold cursor-pointer shadow-sm";
          } else if (isInRange) {
            // User's selected range
            cellClass += "bg-primary/15 text-primary cursor-pointer";
          } else if (isToday(d)) {
            cellClass += "ring-2 ring-primary/40 font-bold cursor-pointer hover:bg-primary/10";
          } else {
            cellClass += "hover:bg-muted cursor-pointer text-foreground";
          }

          return (
            <div
              key={d.toISOString()}
              onClick={() => handleDayClick(d)}
              className={cellClass}
            >
              <span className="leading-none">{format(d, "d")}</span>
              {dotColor && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} absolute bottom-1`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-border">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-300 shrink-0" />
          Занято
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 shrink-0" />
          Мягкий резерв
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30 shrink-0" />
          Ваш выбор
        </span>
      </div>
    </div>
  );
}
