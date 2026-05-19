import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

export function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-white border-t border-border">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <motion.h2
          {...fadeUp}
          className="font-display text-3xl md:text-5xl font-extrabold text-[#2B2B2B] leading-tight mb-6"
        >
          Перестаньте откладывать{" "}
          <span className="text-[#C65D3B]">дорогие вещи</span>{" "}
          на потом.{" "}
          <br className="hidden md:block" />
          Начните пользоваться ими умнее.
        </motion.h2>

        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="text-muted-foreground text-lg mb-10 leading-relaxed"
        >
          Регистрация — одна минута. Никаких подписок и скрытых платежей в режиме беты.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
        >
          <Link
            href="/pools/create"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-semibold text-lg shadow-lg shadow-[#C65D3B]/25 hover:bg-[#a04829] hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Собрать первую покупку
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white border-2 border-[#C65D3B] text-[#C65D3B] font-semibold text-lg hover:bg-[#C65D3B] hover:text-white hover:-translate-y-0.5 transition-all"
          >
            Смотреть каталог
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          Регистрируясь, вы соглашаетесь с{" "}
          <Link href="/privacy" className="text-[#C65D3B] hover:underline font-medium">
            Политикой конфиденциальности
          </Link>
          .
        </motion.p>
      </div>
    </section>
  );
}
