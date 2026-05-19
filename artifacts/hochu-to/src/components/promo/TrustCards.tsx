import { motion } from "framer-motion";
import { Link } from "wouter";
import { FileCheck2, Camera, History, Handshake, ShieldCheck, Users, Scale } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const trustCards = [
  {
    icon: FileCheck2,
    color: "bg-[#E8F0F0]",
    iconColor: "text-[#4A8587]",
    title: "Цифровой акт",
    desc: "Каждая сделка фиксируется электронным актом с фото и электронной подписью обеих сторон. Никакого «он сказала — она сказала».",
  },
  {
    icon: Camera,
    color: "bg-[#FBEDE7]",
    iconColor: "text-[#C65D3B]",
    title: "Фото-фиксация",
    desc: "Минимум 4 фото с разных ракурсов при передаче и возврате. GPS-метки и EXIF-данные делают подлог невозможным.",
  },
  {
    icon: History,
    color: "bg-[#EDF2F0]",
    iconColor: "text-[#2F5C5E]",
    title: "История сделок",
    desc: "Рейтинг доверия от 0 до 100 — живой индикатор репутации каждого участника, сформированный из реальных оценок и статистики.",
  },
  {
    icon: Handshake,
    color: "bg-[#F5F0E8]",
    iconColor: "text-[#8E6B2B]",
    title: "Прозрачная передача",
    desc: "Статус брони виден обеим сторонам в реальном времени. Переход к активной аренде — только после подписанного акта приёмки.",
  },
];

const securityBullets = [
  {
    icon: Users,
    title: "Прозрачность ролей",
    desc: "Арендатор и владелец видят друг друга: рейтинг, историю, верификацию. Анонимности нет — ответственность есть.",
  },
  {
    icon: ShieldCheck,
    title: "Гарантийный фонд",
    desc: "Взносы участников формируют общий фонд взаимопомощи. Если залога недостаточно — фонд покрывает ущерб по итогам арбитража.",
    link: "/guarantee-fund",
  },
  {
    icon: Scale,
    title: "Система арбитража",
    desc: "При спорах — независимый разбор с AI-анализом фото. Модератор принимает решение по доказательствам, а не словам.",
  },
];

export function TrustCards() {
  return (
    <>
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-sm font-semibold mb-6">
              <ShieldCheck className="w-4 h-4" />
              База доверия
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-[#2B2B2B] leading-tight mb-4">
              Четыре кита,{" "}
              <span className="text-[#4A8587]">на которых стоит сделка</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Каждый из них работает прямо сейчас — не в планах, а в коде.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {trustCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl p-6 border border-border bg-gradient-to-br from-[#F2EEE3]/40 to-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center mb-4`}>
                  <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
                <h3 className="font-display font-bold text-base mb-2 text-[#2B2B2B]">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-gradient-to-b from-[#F2EEE3] to-[#FBEDE7]">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#2B2B2B] leading-tight mb-4">
              Почему нас{" "}
              <span className="text-[#C65D3B]">нельзя кинуть</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Безопасность сделки — не слова, а архитектура платформы.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="flex flex-col gap-5"
          >
            {securityBullets.map((item) => (
              <div
                key={item.title}
                className="flex gap-5 bg-white rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FBEDE7] flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-[#C65D3B]" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base mb-1 text-[#2B2B2B]">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.desc}{" "}
                    {item.link && (
                      <Link href={item.link} className="text-[#C65D3B] font-medium hover:underline">
                        Подробнее →
                      </Link>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="mt-10 text-center"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C65D3B]/10 text-[#8E3F23] text-sm font-semibold">
              🚀 Бета-режим: строим сообщество ранних пользователей
            </span>
          </motion.div>
        </div>
      </section>
    </>
  );
}
