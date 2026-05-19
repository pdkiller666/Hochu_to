import { motion } from "framer-motion";
import { Link } from "wouter";
import { TrendingUp, ArrowRight } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const steps = [
  {
    num: "01",
    title: "Опубликуйте вещь",
    desc: "Загрузите фото и описание — встроенный ИИ-помощник подготовит текст за минуту.",
  },
  {
    num: "02",
    title: "Принимайте брони",
    desc: "Каждый арендатор виден по Рейтингу доверия. Вы всегда принимаете решение сами.",
  },
  {
    num: "03",
    title: "Получайте оплату",
    desc: "P2P-переводы напрямую через СБП. Никаких скрытых комиссий в режиме беты.",
  },
];

export function OwnerSteps() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-sm font-semibold mb-6">
            <TrendingUp className="w-4 h-4" />
            Для владельцев
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-[#2B2B2B] leading-tight mb-4">
            А что если вещь будет{" "}
            <span className="text-[#4A8587]">работать на вас?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Дрель, электросамокат, проектор — всё, чем вы пользуетесь раз в месяц,
            может окупать само себя.
          </p>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl p-8 bg-gradient-to-br from-[#F2EEE3] to-white border border-border shadow-sm"
            >
              <div className="text-4xl font-display font-extrabold text-[#C65D3B] mb-3">
                {step.num}
              </div>
              <h3 className="font-display font-bold text-lg mb-2 text-[#2B2B2B]">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="text-center"
        >
          <Link
            href="/dashboard/listings/new"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#C65D3B] text-white font-semibold text-lg shadow-lg shadow-[#C65D3B]/25 hover:bg-[#a04829] hover:-translate-y-0.5 transition-all"
          >
            Сдать свою вещь
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
