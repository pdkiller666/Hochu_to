import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, Users, ArrowRight, TrendingDown } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const cases = [
  {
    title: "Квадрокоптер DJI",
    tag: "Дрон",
    price: "89 990",
    share: "18 000",
    filled: 3,
    total: 5,
    img: "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=480&q=80&auto=format&fit=crop",
    emoji: "🚁",
    hot: true,
  },
  {
    title: "Проектор Epson 4K",
    tag: "Проектор",
    price: "54 000",
    share: "10 800",
    filled: 2,
    total: 5,
    img: "https://images.unsplash.com/photo-1604754742629-3e5728249d73?w=480&q=80&auto=format&fit=crop",
    emoji: "🎬",
    hot: false,
  },
  {
    title: "Sony Alpha A7 IV",
    tag: "Камера",
    price: "199 990",
    share: "40 000",
    filled: 4,
    total: 5,
    img: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=480&q=80&auto=format&fit=crop",
    emoji: "📷",
    hot: true,
  },
  {
    title: "PlayStation 5",
    tag: "Консоль",
    price: "69 990",
    share: "14 000",
    filled: 1,
    total: 5,
    img: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=480&q=80&auto=format&fit=crop",
    emoji: "🎮",
    hot: false,
  },
];

export function CaseStudies() {
  return (
    <section className="py-20 md:py-28 bg-[#F2EEE3] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#C65D3B]/6 blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#C65D3B] text-white text-sm font-bold mb-6 shadow-lg shadow-[#C65D3B]/25">
            <Sparkles className="w-4 h-4" />
            Killer-фича платформы
          </span>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-[#2B2B2B] leading-tight mb-4">
            На что собираемся{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #C65D3B 0%, #E8854A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              вместе?
            </span>
          </h2>
          <p className="text-[#5A5A5A] text-lg max-w-2xl mx-auto leading-relaxed">
            Скиньтесь впятером — сэкономьте{" "}
            <strong className="text-[#C65D3B]">до 80%</strong> от стоимости.
            Каждый владеет долей и получает доступ.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {cases.map((item, i) => {
            const saving = Math.round((1 - Number(item.share.replace(/\s/g, "")) / Number(item.price.replace(/\s/g, ""))) * 100);
            const pct = Math.round((item.filled / item.total) * 100);
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group"
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden bg-[#F2EEE3]">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-107 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!.style.background = "#F2EEE3";
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-xs font-bold text-[#2B2B2B] shadow-sm">
                      {item.emoji} {item.tag}
                    </span>
                    {item.hot && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#C65D3B] text-white text-xs font-bold shadow-sm">
                        🔥 Горячий
                      </span>
                    )}
                  </div>

                  {/* Savings badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#C65D3B] text-white text-xs font-extrabold shadow-md">
                      <TrendingDown className="w-3 h-3" />
                      −{saving}%
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-display font-bold text-base text-[#2B2B2B] mb-3 leading-snug">{item.title}</h3>

                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[#999]">Полная цена</span>
                    <span className="font-medium text-[#999] line-through">{item.price} ₽</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[#4A8587] font-semibold text-sm">Ваша доля (1/{item.total})</span>
                    <span className="font-extrabold text-[#C65D3B] text-xl">{item.share} ₽</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#999] flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.filled} из {item.total} участников
                      </span>
                      <span className="font-bold text-[#4A8587]">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F2EEE3] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-[#4A8587] to-[#C65D3B] rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="text-center">
          <Link
            href="/pools"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-[#2B2B2B] text-white font-bold text-lg shadow-xl shadow-black/20 hover:bg-[#3D3D3D] hover:-translate-y-1 transition-all duration-200 group"
          >
            Смотреть все пулы
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
