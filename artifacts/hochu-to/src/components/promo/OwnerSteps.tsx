import { motion } from "framer-motion";
import { Link } from "wouter";
import { TrendingUp, ArrowRight } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Опубликуйте вещь",
    desc: "Загрузите фото и описание — встроенный ИИ-помощник подготовит текст за минуту.",
    accent: "#C65D3B",
  },
  {
    num: "02",
    title: "Принимайте брони",
    desc: "Каждый арендатор виден по Рейтингу доверия. Вы всегда принимаете решение сами.",
    accent: "#4A8587",
  },
  {
    num: "03",
    title: "Получайте оплату",
    desc: "P2P-переводы напрямую через СБП. Никаких скрытых комиссий в режиме беты.",
    accent: "#8E6B2B",
  },
];

export function OwnerSteps() {
  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-[#4A8587]/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-sm font-bold mb-6">
            <TrendingUp className="w-4 h-4" />
            Для владельцев вещей
          </span>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-[#2B2B2B] leading-tight mb-4">
            А что если вещь будет{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #4A8587, #2F5C5E)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              работать на вас?
            </span>
          </h2>
          <p className="text-[#5A5A5A] text-lg max-w-2xl mx-auto leading-relaxed">
            Дрель, самокат, проектор — всё, чем вы пользуетесь раз в месяц,
            может окупать само себя.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="rounded-3xl p-8 border-2 border-border bg-[#F2EEE3]/60 relative overflow-hidden group"
            >
              {/* Large background number */}
              <div
                className="absolute -top-4 -right-2 text-8xl font-display font-extrabold opacity-[0.06] select-none"
                style={{ color: step.accent }}
              >
                {step.num}
              </div>
              {/* Accent dot */}
              <div
                className="w-3 h-3 rounded-full mb-6"
                style={{ background: step.accent }}
              />
              <div
                className="text-4xl font-display font-extrabold mb-3"
                style={{ color: step.accent }}
              >
                {step.num}
              </div>
              <h3 className="font-display font-bold text-xl mb-3 text-[#2B2B2B]">{step.title}</h3>
              <p className="text-[#5A5A5A] text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center"
        >
          <Link
            href="/dashboard/listings/new"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-bold text-lg shadow-xl shadow-[#C65D3B]/25 hover:bg-[#a04829] hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 group"
          >
            Сдать свою вещь
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
