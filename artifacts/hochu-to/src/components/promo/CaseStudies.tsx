import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, Users, ArrowRight } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const cases = [
  {
    title: "Квадрокоптер DJI",
    tag: "Дрон",
    price: "89 990 ₽",
    share: "18 000 ₽",
    img: "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=480&q=80&auto=format&fit=crop",
    emoji: "🚁",
  },
  {
    title: "Проектор 4K",
    tag: "Проектор",
    price: "54 000 ₽",
    share: "10 800 ₽",
    img: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=480&q=80&auto=format&fit=crop",
    emoji: "🎬",
  },
  {
    title: "Sony Alpha A7 IV",
    tag: "Камера",
    price: "199 990 ₽",
    share: "40 000 ₽",
    img: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=480&q=80&auto=format&fit=crop",
    emoji: "📷",
  },
  {
    title: "PlayStation 5",
    tag: "Консоль",
    price: "69 990 ₽",
    share: "14 000 ₽",
    img: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=480&q=80&auto=format&fit=crop",
    emoji: "🎮",
  },
];

export function CaseStudies() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-[#FBEDE7] via-[#F2EEE3] to-[#F2EEE3]">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C65D3B] text-white text-sm font-bold mb-6 shadow-md shadow-[#C65D3B]/20">
            <Sparkles className="w-4 h-4" />
            Совместные покупки
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-[#2B2B2B] leading-tight mb-4">
            На что собираемся{" "}
            <span className="text-[#C65D3B]">вместе?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Скиньтесь впятером — сэкономьте 80% от стоимости.
            Каждый владеет долей и получает доступ.
          </p>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {cases.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group"
            >
              <div className="relative h-44 overflow-hidden bg-[#F2EEE3]">
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-bold text-[#2B2B2B] shadow-sm">
                    {item.emoji} {item.tag}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display font-bold text-base text-[#2B2B2B] mb-3">{item.title}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Полная цена</span>
                  <span className="font-semibold text-[#2B2B2B] line-through opacity-50">{item.price}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[#4A8587] font-medium">Ваша доля (1/5)</span>
                  <span className="font-bold text-[#C65D3B] text-base">{item.share}</span>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>Нужно ещё 4 участника</span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="text-center"
        >
          <Link
            href="/pools"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white border-2 border-[#C65D3B] text-[#C65D3B] font-semibold text-lg hover:bg-[#C65D3B] hover:text-white hover:-translate-y-0.5 transition-all shadow-sm"
          >
            Смотреть все пулы
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
