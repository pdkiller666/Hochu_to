import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="relative py-24 md:py-36 bg-[#C65D3B] overflow-hidden">
      {/* Animated background blobs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/8 blur-2xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], rotate: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-black/8 blur-2xl pointer-events-none"
      />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 border border-white/25 text-white text-sm font-bold mb-8 backdrop-blur"
        >
          <Zap className="w-4 h-4 fill-white" />
          Начните прямо сейчас — это бесплатно
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6"
        >
          Перестаньте откладывать
          <br />
          <span className="text-white/60">дорогие вещи на потом.</span>
          <br />
          Начните пользоваться
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #fff 0%, #FBEDE7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ими умнее.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-white/70 text-lg md:text-xl mb-10 leading-relaxed"
        >
          Регистрация — одна минута. Никаких подписок и скрытых платежей в бета-режиме.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-10"
        >
          <Link
            href="/pools/create"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white text-[#C65D3B] font-extrabold text-lg shadow-2xl shadow-black/20 hover:bg-[#F2EEE3] hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 group"
          >
            Собрать первую покупку
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/10 border-2 border-white/30 text-white font-bold text-lg backdrop-blur hover:bg-white/20 hover:-translate-y-1 transition-all duration-200"
          >
            Смотреть каталог
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-white/40 text-sm"
        >
          Регистрируясь, вы соглашаетесь с{" "}
          <Link href="/privacy" className="text-white/70 hover:text-white underline underline-offset-2 font-medium">
            Политикой конфиденциальности
          </Link>
          .
        </motion.p>
      </div>
    </section>
  );
}
