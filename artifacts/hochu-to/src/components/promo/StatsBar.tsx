import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface StatProps {
  value: number;
  suffix: string;
  label: string;
  color: string;
}

function AnimatedStat({ value, suffix, label, color }: StatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-center group">
      <div
        className="font-display text-6xl md:text-7xl font-extrabold mb-2 tabular-nums"
        style={{ color }}
      >
        {display.toLocaleString("ru-RU")}
        <span className="text-4xl md:text-5xl">{suffix}</span>
      </div>
      <p className="text-[#5A5A5A] font-semibold text-base md:text-lg">{label}</p>
    </div>
  );
}

const stats: StatProps[] = [
  { value: 1200, suffix: "+", label: "участников в бете", color: "#C65D3B" },
  { value: 340,  suffix: "+", label: "объявлений в каталоге", color: "#4A8587" },
  { value: 98,   suffix: "%", label: "сделок без споров", color: "#8E6B2B" },
];

export function StatsBar() {
  return (
    <section className="py-16 md:py-20 bg-white border-y border-border">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border"
        >
          {stats.map((s) => (
            <AnimatedStat key={s.label} {...s} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
