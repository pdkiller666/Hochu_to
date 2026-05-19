import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, FileCheck2, Camera, Handshake, Users } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const chips = [
  { icon: FileCheck2, label: "Цифровые акты" },
  { icon: Camera, label: "Фото-фиксация" },
  { icon: Handshake, label: "Понятная передача" },
  { icon: Users, label: "Совместные покупки" },
];

export function Hero() {
  return (
    <section className="relative py-24 md:py-36 bg-gradient-to-br from-[#F2EEE3] via-[#F2EEE3] to-[#FBEDE7] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute top-16 left-8 w-80 h-80 rounded-full bg-[#C65D3B]/10 blur-3xl" />
        <div className="absolute bottom-8 right-8 w-96 h-96 rounded-full bg-[#4A8587]/10 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 text-center">
        <motion.h1
          {...fadeUp}
          className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-6 text-[#2B2B2B]"
        >
          Хорошие вещи не должны{" "}
          <span className="text-[#C65D3B]">пылиться</span>.{" "}
          <br className="hidden md:block" />
          Они должны приносить{" "}
          <span className="text-[#4A8587]">пользу, эмоции и доступ</span>.
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Хочу_То — это безопасная аренда и новый формат владения вещами,
          о которых вы давно мечтали.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-10"
        >
          <Link
            href="/dashboard/listings/new"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-[#C65D3B] text-white font-semibold text-lg shadow-lg shadow-[#C65D3B]/25 hover:bg-[#a04829] hover:shadow-xl hover:shadow-[#C65D3B]/30 hover:-translate-y-0.5 transition-all"
          >
            Сдать свою вещь
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/how-to-rent"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white border-2 border-[#C65D3B] text-[#C65D3B] font-semibold text-lg shadow-sm hover:bg-[#C65D3B] hover:text-white hover:-translate-y-0.5 transition-all"
          >
            Как это работает
          </Link>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {chips.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-[#C65D3B]/20 text-sm text-[#2B2B2B] font-medium shadow-sm"
            >
              <Icon className="w-4 h-4 text-[#C65D3B]" />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
