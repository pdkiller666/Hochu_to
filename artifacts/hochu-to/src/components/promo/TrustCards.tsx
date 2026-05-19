import { motion } from "framer-motion";
import { Link } from "wouter";
import { FileCheck2, Camera, History, Handshake, ShieldCheck, Users, Scale } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const trustCards = [
  {
    num: "01",
    icon: FileCheck2,
    bg: "bg-gradient-to-br from-[#4A8587] to-[#2F5C5E]",
    title: "Цифровой акт",
    desc: "Электронный акт с фото и подписями обеих сторон. Никакого «он сказала — она сказала».",
    light: false,
  },
  {
    num: "02",
    icon: Camera,
    bg: "bg-gradient-to-br from-[#FBEDE7] to-[#F2EEE3]",
    title: "Фото-фиксация",
    desc: "Минимум 4 фото с разных ракурсов + GPS-метки и EXIF. Подлог невозможен.",
    light: true,
  },
  {
    num: "03",
    icon: History,
    bg: "bg-gradient-to-br from-[#2B2B2B] to-[#3D3D3D]",
    title: "История сделок",
    desc: "Рейтинг доверия 0–100. Живой индекс из реальных отзывов и статистики.",
    light: false,
  },
  {
    num: "04",
    icon: Handshake,
    bg: "bg-gradient-to-br from-[#C65D3B] to-[#a04829]",
    title: "Прозрачная передача",
    desc: "Активная аренда начинается только после подписанного акта приёмки.",
    light: false,
  },
];

const securityBullets = [
  {
    icon: Users,
    title: "Прозрачность ролей",
    desc: "Арендатор и владелец видят друг друга — рейтинг, историю, верификацию. Анонимности нет.",
    accent: "#4A8587",
    bg: "bg-[#4A8587]/10",
  },
  {
    icon: ShieldCheck,
    title: "Гарантийный фонд",
    desc: "Взносы участников формируют фонд взаимопомощи. Залога недостаточно — фонд компенсирует.",
    link: "/guarantee-fund",
    accent: "#C65D3B",
    bg: "bg-[#C65D3B]/10",
  },
  {
    icon: Scale,
    title: "AI-арбитраж",
    desc: "Спор? Gemini Vision анализирует фото «до/после». Модератор решает по доказательствам.",
    accent: "#8E6B2B",
    bg: "bg-[#8E6B2B]/10",
  },
];

export function TrustCards() {
  return (
    <>
      {/* Trust cards */}
      <section className="py-20 md:py-28 bg-[#F2EEE3]">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#4A8587] text-white text-sm font-bold mb-6 shadow-lg shadow-[#4A8587]/20">
              <ShieldCheck className="w-4 h-4" />
              База доверия
            </span>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold text-[#2B2B2B] leading-tight mb-4">
              Четыре кита,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #4A8587, #2F5C5E)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                на которых стоит сделка
              </span>
            </h2>
            <p className="text-[#5A5A5A] text-lg max-w-xl mx-auto">
              Каждый работает прямо сейчас — не в планах, а в коде.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {trustCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`rounded-3xl p-7 ${card.bg} shadow-lg cursor-default`}
              >
                <div
                  className={`text-5xl font-display font-extrabold mb-4 ${card.light ? "text-[#C65D3B]/30" : "text-white/20"}`}
                >
                  {card.num}
                </div>
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${card.light ? "bg-[#C65D3B]/15" : "bg-white/15"}`}
                >
                  <card.icon className={`w-6 h-6 ${card.light ? "text-[#C65D3B]" : "text-white"}`} />
                </div>
                <h3 className={`font-display font-bold text-lg mb-2 ${card.light ? "text-[#2B2B2B]" : "text-white"}`}>
                  {card.title}
                </h3>
                <p className={`text-sm leading-relaxed ${card.light ? "text-[#5A5A5A]" : "text-white/70"}`}>
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security bullets — dark background for contrast */}
      <section className="py-20 md:py-28 bg-[#2B2B2B] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C65D3B]/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[#4A8587]/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              Почему нас{" "}
              <span className="text-[#C65D3B]">нельзя кинуть</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Безопасность — не маркетинг, а архитектура платформы.
            </p>
          </motion.div>

          <div className="flex flex-col gap-4">
            {securityBullets.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-5 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/8 transition-colors"
              >
                <div className={`w-13 h-13 w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className="w-6 h-6" style={{ color: item.accent }} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base mb-1 text-white">{item.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {item.desc}{" "}
                    {item.link && (
                      <Link href={item.link} className="text-[#C65D3B] font-semibold hover:underline">
                        Подробнее →
                      </Link>
                    )}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.3 }}
            className="mt-10 text-center"
          >
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#C65D3B]/15 border border-[#C65D3B]/30 text-[#E8854A] text-sm font-bold">
              🚀 Бета-режим: строим сообщество ранних пользователей
            </span>
          </motion.div>
        </div>
      </section>
    </>
  );
}
