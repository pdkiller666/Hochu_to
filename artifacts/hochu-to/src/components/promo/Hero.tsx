import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, FileCheck2, Camera, Handshake, Users, Star } from "lucide-react";

const chips = [
  { icon: FileCheck2, label: "Цифровые акты", color: "from-[#4A8587]/20 to-[#4A8587]/5 border-[#4A8587]/30 text-[#2F5C5E]" },
  { icon: Camera, label: "Фото-фиксация", color: "from-[#C65D3B]/20 to-[#C65D3B]/5 border-[#C65D3B]/30 text-[#8E3F23]" },
  { icon: Handshake, label: "Понятная передача", color: "from-[#8E6B2B]/20 to-[#8E6B2B]/5 border-[#8E6B2B]/30 text-[#6B4F20]" },
  { icon: Users, label: "Совместные покупки", color: "from-[#C65D3B]/20 to-[#C65D3B]/5 border-[#C65D3B]/30 text-[#8E3F23]" },
];

const avatars = [
  { initials: "АИ", bg: "#C65D3B" },
  { initials: "МС", bg: "#4A8587" },
  { initials: "ДК", bg: "#8E6B2B" },
  { initials: "ЕП", bg: "#5A7A52" },
];

export function Hero() {
  return (
    <section className="relative py-24 md:py-36 bg-[#F2EEE3] overflow-hidden">
      {/* Animated blobs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 left-[-80px] w-[420px] h-[420px] rounded-full bg-[#C65D3B]/12 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-0 right-[-60px] w-[500px] h-[500px] rounded-full bg-[#4A8587]/10 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full bg-[#C65D3B]/5 blur-3xl pointer-events-none"
      />

      <div className="relative max-w-5xl mx-auto px-4 text-center">
        {/* Social proof bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white shadow-md border border-[#C65D3B]/15 mb-10"
        >
          <div className="flex -space-x-2">
            {avatars.map((av, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0"
                style={{ backgroundColor: av.bg }}
              >
                {av.initials}
              </div>
            ))}
          </div>
          <span className="text-sm font-semibold text-[#2B2B2B]">
            Уже <span className="text-[#C65D3B]">1 200+</span> участников в бета-версии
          </span>
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-6 text-[#2B2B2B]"
        >
          Хорошие вещи{" "}
          <br className="hidden sm:block" />
          не должны{" "}
          <span
            className="relative inline-block"
            style={{
              background: "linear-gradient(135deg, #C65D3B 0%, #E8854A 50%, #C65D3B 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            пылиться
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-xl md:text-2xl text-[#5A5A5A] max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
        >
          Хочу_То — безопасная аренда и новый формат владения
          вещами, о которых вы давно мечтали.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
        >
          <Link
            href="/dashboard/listings/new"
            className="relative inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-bold text-lg shadow-xl shadow-[#C65D3B]/30 hover:bg-[#a04829] hover:shadow-2xl hover:shadow-[#C65D3B]/35 hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            Сдать свою вещь
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/how-to-rent"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/80 backdrop-blur border-2 border-[#2B2B2B]/15 text-[#2B2B2B] font-bold text-lg shadow-sm hover:border-[#C65D3B] hover:text-[#C65D3B] hover:-translate-y-1 transition-all duration-200"
          >
            Как это работает
          </Link>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {chips.map(({ icon: Icon, label, color }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${color} border text-sm font-semibold shadow-sm`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
