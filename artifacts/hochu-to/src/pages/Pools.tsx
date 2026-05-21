import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { listPools, type PoolListItem } from "@/lib/api-pools";
import { formatPrice } from "@/lib/utils";
import {
  Users, Target, ArrowRight, Plus, Loader2, Sparkles,
  Shield, Zap, Coins, Clock, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

type StatusTab = "funding" | "purchasing" | "active";

const TAB_LABELS: Record<StatusTab, string> = {
  funding: "Идёт сбор",
  purchasing: "Идёт закупка",
  active: "Активные",
};

const STEPS = [
  {
    num: "01",
    accent: "#C65D3B",
    icon: Target,
    title: "Создайте пул",
    desc: "Укажите вещь, нужную сумму и стратегию закупки. Приглашайте участников по ссылке.",
  },
  {
    num: "02",
    accent: "#4A8587",
    icon: Users,
    title: "Соберите участников",
    desc: "Каждый переводит свою долю инициатору по СБП напрямую — без лишних комиссий.",
  },
  {
    num: "03",
    accent: "#8E6B2B",
    icon: Clock,
    title: "Владейте по очереди",
    desc: "График пользования фиксируется Цифровым актом. Платформа защищает каждую передачу.",
  },
];

const CHIPS = [
  { icon: Zap,    label: "Без эскроу-комиссий", color: "from-[#C65D3B]/20 to-[#C65D3B]/5 border-[#C65D3B]/30 text-[#8E3F23]" },
  { icon: Shield, label: "Цифровые акты",        color: "from-[#4A8587]/20 to-[#4A8587]/5 border-[#4A8587]/30 text-[#2F5C5E]" },
  { icon: Coins,  label: "Экономия до 80%",       color: "from-[#8E6B2B]/20 to-[#8E6B2B]/5 border-[#8E6B2B]/30 text-[#6B4F20]" },
  { icon: Users,  label: "Долевое владение",      color: "from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-700" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function Pools() {
  const [tab, setTab] = useState<StatusTab>("funding");
  const { data: pools, isLoading, error } = useQuery({
    queryKey: ["pools", tab],
    queryFn: () => listPools(tab),
  });

  return (
    <Layout>
      {/* ══════ HERO ══════ */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#2e6566] via-[#4A8587] to-[#3a7577] overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-[-100px] w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, -20, 0], y: [0, 25, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-50px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[#C65D3B]/15 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 left-1/3 w-[600px] h-[200px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 border border-white/25 text-white text-sm font-bold mb-8 backdrop-blur"
          >
            <Sparkles className="w-4 h-4 fill-white/80" />
            Co-Sharing · Soft Launch Beta
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6 text-white"
          >
            Вместе дешевле.{" "}
            <br className="hidden sm:block" />
            <span
              style={{
                background: "linear-gradient(135deg, #FBEDE7 0%, #E8A882 50%, #FBEDE7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Вместе владеем.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Дорогая вещь нужна редко — покупать одному накладно. Создайте пул, соберите участников
            и владейте по очереди. Переводы напрямую по СБП, без скрытых комиссий.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link
              href="/pools/create"
              className="relative inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-bold text-lg shadow-xl shadow-[#C65D3B]/40 hover:bg-[#a04829] hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Plus className="w-5 h-5" />
              Создать пул
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/25 text-white font-bold text-lg hover:bg-white/20 hover:-translate-y-1 transition-all duration-200"
            >
              Как это работает
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {CHIPS.map(({ icon: Icon, label, color }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${color} border text-sm font-semibold shadow-sm backdrop-blur`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════ STATS ══════ */}
      <section className="py-8 bg-white border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: "до 80%", label: "экономия на технике" },
              { value: "0 ₽",    label: "эскроу-комиссия" },
              { value: "100%",   label: "защита цифровыми актами" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#C65D3B]">{value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-20 md:py-28 bg-[#F2EEE3] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#4A8587]/8 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#C65D3B]/5 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-sm font-bold mb-6">
              <Users className="w-4 h-4" />
              Как это работает
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B2B2B] leading-tight mb-4">
              Три шага до{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #4A8587, #2e6566)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                совместного владения
              </span>
            </h2>
            <p className="text-[#5A5A5A] text-lg max-w-xl mx-auto">
              Прозрачная схема без посредников и скрытых платежей.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="rounded-3xl p-8 border-2 border-border/60 bg-white relative overflow-hidden"
                >
                  <div
                    className="absolute -top-4 -right-2 text-8xl font-display font-extrabold opacity-[0.05] select-none"
                    style={{ color: step.accent }}
                  >
                    {step.num}
                  </div>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm"
                    style={{ background: `${step.accent}18` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: step.accent }} />
                  </div>
                  <div className="text-3xl font-display font-extrabold mb-2" style={{ color: step.accent }}>
                    {step.num}
                  </div>
                  <h3 className="font-display font-bold text-xl mb-3 text-[#2B2B2B]">{step.title}</h3>
                  <p className="text-[#5A5A5A] text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════ POOLS LIST ══════ */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2B2B2B]">Открытые пулы</h2>
              <p className="text-[#5A5A5A] text-sm mt-1">Присоединяйтесь или создайте свой</p>
            </div>
            <Link
              href="/pools/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C65D3B] text-white font-bold rounded-xl shadow hover:shadow-lg hover:bg-[#a04829] hover:-translate-y-0.5 transition-all text-sm"
            >
              <Plus className="w-4 h-4" /> Создать пул
            </Link>
          </div>

          <div className="flex gap-1 p-1 bg-muted/60 rounded-2xl mb-8 w-fit">
            {(["funding", "purchasing", "active"] as StatusTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
                  tab === t
                    ? "bg-white text-[#4A8587] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="py-20 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {error && (
            <div className="py-20 text-center text-red-600">
              Не удалось загрузить пулы. Попробуйте обновить страницу.
            </div>
          )}

          {pools && pools.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-20 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#4A8587]/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-10 h-10 text-[#4A8587]/50" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-[#2B2B2B]">Пока нет пулов в этом разделе</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {tab === "funding"
                  ? "Будьте первым — создайте пул на нужную вам вещь."
                  : "Здесь появятся пулы, как только перейдут в этот статус."}
              </p>
              {tab === "funding" && (
                <Link
                  href="/pools/create"
                  className="inline-flex items-center gap-2 px-7 py-3 bg-[#C65D3B] text-white font-bold rounded-xl shadow-lg hover:bg-[#a04829] hover:-translate-y-0.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Создать первый пул
                </Link>
              )}
            </motion.div>
          )}

          {pools && pools.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10"
            >
              {pools.map((p, i) => (
                <motion.div key={p.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                  <PoolCard pool={p} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-r from-[#4A8587] to-[#2e6566]">
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/8 blur-2xl pointer-events-none"
        />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl sm:text-5xl font-extrabold text-white mb-4"
          >
            Готовы купить вместе?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white/75 text-lg mb-8"
          >
            Создайте пул за 2 минуты — это бесплатно в бета-режиме.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/pools/create"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-extrabold text-lg shadow-2xl hover:bg-[#a04829] hover:-translate-y-1 transition-all duration-200 group"
            >
              <Plus className="w-5 h-5" />
              Создать пул
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/catalog"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/10 border-2 border-white/30 text-white font-bold text-lg hover:bg-white/20 hover:-translate-y-1 transition-all duration-200"
            >
              Смотреть каталог аренды
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}

function PoolCard({ pool }: { pool: PoolListItem }) {
  const pct = Math.min(100, Math.round((pool.collectedAmountRub / pool.targetAmountRub) * 100));
  const isHot = pct >= 70;
  return (
    <Link
      href={`/pools/${pool.id}`}
      className="group block bg-white rounded-2xl border-2 border-border/60 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#4A8587]/40 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-[#4A8587] transition-colors">
          {pool.title}
        </h3>
        <span
          className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${
            isHot ? "bg-[#C65D3B]/10 text-[#C65D3B]" : "bg-[#4A8587]/10 text-[#4A8587]"
          }`}
        >
          {isHot ? "🔥 Горячий" : "СБП"}
        </span>
      </div>
      {pool.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{pool.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-baseline text-sm">
          <span className="font-bold text-[#C65D3B] text-base">{formatPrice(pool.collectedAmountRub)}</span>
          <span className="text-muted-foreground text-xs">из {formatPrice(pool.targetAmountRub)}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isHot ? "bg-[#C65D3B]" : "bg-[#4A8587]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className={`font-bold ${isHot ? "text-[#C65D3B]" : "text-[#4A8587]"}`}>{pct}% собрано</span>
          <span className="text-muted-foreground">
            {pool.procurementStrategy === "self_managed" ? "Самозакуп" : "Консьерж"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs">участников</span>
        </div>
        <div className="flex items-center gap-1 text-[#4A8587] font-bold text-sm group-hover:gap-2 transition-all">
          Подробнее <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
