import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import {
  Hammer, Tent, Trees, PartyPopper, Baby, Laptop,
  ArrowRight, Star, Shield, Camera, FileCheck2,
  Handshake, TrendingUp, Search, Users, Sparkles, Cpu,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ListingCarouselSection } from "@/components/ui/ListingCarouselSection";
import { Ticker } from "@/components/promo/Ticker";
import { StatsBar } from "@/components/promo/StatsBar";
import { useDocumentMeta } from "@/lib/use-document-meta";

// ─── Статика ──────────────────────────────────────────────────────────────────

const POPULAR_CATEGORIES = [
  { name: "Стройка и ремонт",  icon: Hammer,      slug: "construction", color: "bg-orange-100 text-orange-600" },
  { name: "Туризм и спорт",    icon: Tent,         slug: "tourism",      color: "bg-teal-100 text-teal-600"   },
  { name: "Сад и огород",      icon: Trees,        slug: "garden",       color: "bg-green-100 text-green-600" },
  { name: "Праздники",         icon: PartyPopper,  slug: "holidays",     color: "bg-purple-100 text-purple-600"},
  { name: "Детские товары",    icon: Baby,         slug: "children",     color: "bg-pink-100 text-pink-600"   },
  { name: "Электроника",       icon: Laptop,       slug: "electronics",  color: "bg-blue-100 text-blue-600"   },
];

const AVATARS = [
  "https://i.pravatar.cc/40?img=1",
  "https://i.pravatar.cc/40?img=5",
  "https://i.pravatar.cc/40?img=8",
  "https://i.pravatar.cc/40?img=12",
];

const FEATURE_CHIPS = [
  { icon: FileCheck2, label: "Цифровые акты",   color: "from-[#4A8587]/20 to-[#4A8587]/5 border-[#4A8587]/30 text-[#2F5C5E]" },
  { icon: Shield,     label: "Гарантийный фонд",color: "from-[#C65D3B]/20 to-[#C65D3B]/5 border-[#C65D3B]/30 text-[#8E3F23]" },
  { icon: Cpu,        label: "ИИ-Арбитраж",     color: "from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-700" },
  { icon: Handshake,  label: "Защита сделки",   color: "from-[#8E6B2B]/20 to-[#8E6B2B]/5 border-[#8E6B2B]/30 text-[#6B4F20]" },
];

const RENTER_STEPS = [
  {
    num: "01",
    accent: "#C65D3B",
    icon: Search,
    title: "Найдите нужную вещь",
    desc: "Используйте поиск или каталог по категориям, выберите удобные даты в календаре.",
  },
  {
    num: "02",
    accent: "#4A8587",
    icon: FileCheck2,
    title: "Оформите заявку",
    desc: "Владелец подтвердит бронирование. Цифровой акт зафиксирует состояние вещи при передаче.",
  },
  {
    num: "03",
    accent: "#8E6B2B",
    icon: Handshake,
    title: "Используйте и верните",
    desc: "Решите свою задачу и верните вещь. Гарантийный фонд защищает обе стороны сделки.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function Home() {
  useDocumentMeta({
    title: "Аренда вещей рядом с вами",
    description:
      "ХочуТо — платформа аренды вещей с гарантийным фондом. Инструменты, техника, туристическое снаряжение — арендуйте безопасно и выгодно.",
  });

  return (
    <Layout>
      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative py-20 md:py-32 bg-[#F2EEE3] overflow-hidden">
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
          {/* Social proof pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white shadow-md border border-[#C65D3B]/15 mb-10"
          >
            <div className="flex -space-x-2">
              {AVATARS.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-7 h-7 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-[#2B2B2B]">
              Уже <span className="text-[#C65D3B]">1 200+</span> участников
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
            className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-6 text-[#2B2B2B]"
          >
            Зачем покупать,{" "}
            <br className="hidden sm:block" />
            <span
              style={{
                background: "linear-gradient(135deg, #C65D3B 0%, #E8854A 50%, #C65D3B 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              если можно арендовать?
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-[#5A5A5A] max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Крупнейший маркетплейс аренды вещей от людей к людям. Инструменты, техника, туристическое снаряжение — безопасно и выгодно.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link
              href="/catalog"
              className="relative inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] font-bold text-lg shadow-xl shadow-[#C65D3B]/30 hover:bg-[#a04829] hover:shadow-2xl hover:shadow-[#C65D3B]/35 hover:-translate-y-1 transition-all duration-200 overflow-hidden group text-[#ffffff]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              Смотреть каталог
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/auth?tab=register"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/80 backdrop-blur border-2 border-[#2B2B2B]/15 text-[#2B2B2B] font-bold text-lg shadow-sm hover:border-[#C65D3B] hover:text-[#C65D3B] hover:-translate-y-1 transition-all duration-200"
            >
              Сдать вещь в аренду
            </Link>
          </motion.div>

          {/* Feature chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {FEATURE_CHIPS.map(({ icon: Icon, label, color }) => (
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
      {/* ══════════════════════════════════════════
          STICKY CATEGORY BAR
      ══════════════════════════════════════════ */}
      <div className="bg-background border-b border-border/50 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex gap-2 overflow-x-auto py-2.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
            {POPULAR_CATEGORIES.map(({ slug, icon: Icon, name, color }) => (
              <Link
                key={slug}
                href={`/catalog?category=${slug}`}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white hover:border-primary hover:text-primary text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
              >
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", color)}>
                  <Icon className="w-3 h-3" />
                </div>
                {name}
              </Link>
            ))}
            <Link
              href="/catalog"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm hover:bg-primary/90 transition-colors"
            >
              Все →
            </Link>
          </div>
        </div>
      </div>
      {/* ══════════════════════════════════════════
          TICKER
      ══════════════════════════════════════════ */}
      <Ticker />
      {/* ══════════════════════════════════════════
          КАРУСЕЛЬ 1 — Хиты аренды
      ══════════════════════════════════════════ */}
      <ListingCarouselSection
        title="Хиты аренды"
        subtitle="Самые востребованные вещи на платформе"
        icon="🔥"
        badge={{ label: "ТОП", className: "bg-orange-100 text-orange-600" }}
        sort="popular"
        catalogLink="/catalog?sort=popular"
        bgClassName="bg-background"
      />
      {/* ══════════════════════════════════════════
          PROMO BANNERS (двойной)
      ══════════════════════════════════════════ */}
      <section className="py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Гарантийный фонд */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Link
                href="/guarantee-fund"
                className="group relative flex items-center gap-5 p-6 rounded-2xl bg-gradient-to-br from-[#C65D3B] to-[#a04829] text-white overflow-hidden shadow-xl shadow-[#C65D3B]/20 hover:-translate-y-1 transition-all duration-300 h-full"
              >
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Защита сделки</p>
                  <h3 className="font-bold text-[#2b2b2b] bg-[transparent] border-t-[#2b2b2b] border-r-[#2b2b2b] border-b-[#2b2b2b] border-l-[#2b2b2b] text-[24px]">Гарантийный фонд</h3>
                  <p className="text-sm text-white/75 mt-1">Компенсация ущерба при спорах. 98% сделок без проблем.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            </motion.div>

            {/* Пул-шеринг */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Link
                href="/pools"
                className="group relative flex items-center gap-5 p-6 rounded-2xl bg-gradient-to-br from-[#4A8587] to-[#2e6566] text-white overflow-hidden shadow-xl shadow-[#4A8587]/20 hover:-translate-y-1 transition-all duration-300 h-full"
              >
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Новая функция</p>
                  <h3 className="font-bold text-lg leading-tight">Пул-шеринг</h3>
                  <p className="text-sm text-white/75 mt-1">Покупайте вещи вместе — экономия до 80% на технике мечты.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════════
          КАРУСЕЛЬ 2 — Новинки
      ══════════════════════════════════════════ */}
      <ListingCarouselSection
        title="Новинки"
        subtitle="Только что появились на платформе"
        icon="✨"
        badge={{ label: "НОВОЕ", className: "bg-teal-100 text-teal-600" }}
        sort="new"
        catalogLink="/catalog"
        bgClassName="bg-white"
        quality
      />
      {/* ══════════════════════════════════════════
          КАК ЭТО РАБОТАЕТ
      ══════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-[#F2EEE3] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#C65D3B]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#4A8587]/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#C65D3B]/10 text-[#C65D3B] text-sm font-bold mb-6">
              <Search className="w-4 h-4" />
              Для арендаторов
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B2B2B] leading-tight mb-4">
              Три шага до{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #C65D3B, #E8854A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                нужной вещи
              </span>
            </h2>
            <p className="text-[#5A5A5A] text-lg max-w-xl mx-auto">
              Всё просто и безопасно — от поиска до возврата под защитой платформы.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {RENTER_STEPS.map((step, i) => {
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
                  <div
                    className="text-3xl font-display font-extrabold mb-2"
                    style={{ color: step.accent }}
                  >
                    {step.num}
                  </div>
                  <h3 className="font-display font-bold text-xl mb-3 text-[#2B2B2B]">{step.title}</h3>
                  <p className="text-[#5A5A5A] text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            custom={3}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mt-12"
          >
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-bold text-lg shadow-xl shadow-[#C65D3B]/25 hover:bg-[#a04829] hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 group"
            >
              Найти вещь сейчас
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
      {/* ══════════════════════════════════════════
          STATS BAR (анимированные счётчики)
      ══════════════════════════════════════════ */}
      <StatsBar />
      {/* ══════════════════════════════════════════
          КАРУСЕЛЬ 3 — Высокий рейтинг
      ══════════════════════════════════════════ */}
      <ListingCarouselSection
        title="Высокий рейтинг"
        subtitle="Вещи с лучшими отзывами арендаторов"
        icon="⭐"
        badge={{ label: "4.5+", className: "bg-amber-100 text-amber-700" }}
        sort="rating"
        catalogLink="/catalog?sort=rating"
        bgClassName="bg-background"
      />
      {/* ══════════════════════════════════════════
          КАТЕГОРИИ
      ══════════════════════════════════════════ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex items-end justify-between mb-10"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2B2B2B] mb-1">Популярные категории</h2>
              <p className="text-[#5A5A5A] text-sm sm:text-base">От стройки до праздников — у нас есть всё</p>
            </div>
            <Link
              href="/catalog"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-[#C65D3B] hover:underline flex-shrink-0"
            >
              Все категории <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {POPULAR_CATEGORIES.map(({ slug, icon: Icon, name, color }, i) => (
              <motion.div
                key={slug}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Link
                  href={`/catalog?category=${slug}`}
                  className="group flex flex-col items-center p-5 rounded-2xl bg-[#F2EEE3] border border-border/50 hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/30 transition-all duration-300 text-center h-full"
                >
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-sm", color)}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#2B2B2B] leading-tight">{name}</span>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#C65D3B] hover:underline"
            >
              Все категории <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════════
          КАРУСЕЛЬ 4 — Выгодные предложения
      ══════════════════════════════════════════ */}
      <ListingCarouselSection
        title="Выгодные предложения"
        subtitle="Арендуй дешевле — экономь больше"
        icon="💸"
        badge={{ label: "ВЫГОДА", className: "bg-green-100 text-green-700" }}
        sort="price_asc"
        catalogLink="/catalog?sort=price_asc"
        bgClassName="bg-background"
      />
      {/* ══════════════════════════════════════════
          СОВМЕСТНЫЕ ЗАКУПКИ
      ══════════════════════════════════════════ */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#4A8587] to-[#2e6566] p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-24 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />

            <div className="relative flex-shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white/15 flex items-center justify-center shadow-xl">
              <Users className="w-12 h-12 md:w-16 md:h-16 text-white" />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#C65D3B] rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 text-white text-center md:text-left relative z-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70 mb-2">Новая функция</p>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3">
                Вместе дешевле —<br className="hidden sm:block" /> совместные закупки
              </h2>
              <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-xl">
                Объединяйтесь с другими пользователями и покупайте нужные вещи оптом по выгодной цене. Создайте заявку или присоединитесь к уже существующей.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center md:justify-start">
                <Link
                  href="/joint-purchases"
                  className="inline-flex items-center gap-2 bg-white text-[#4A8587] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg text-sm sm:text-base"
                >
                  Смотреть закупки
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/joint-purchases"
                  className="inline-flex items-center gap-2 bg-white/15 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/25 transition-colors border border-white/20 text-sm sm:text-base"
                >
                  Создать заявку
                </Link>
              </div>
            </div>

            <div className="relative z-10 flex-shrink-0 grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-2xl md:text-3xl font-extrabold text-white">до 40%</p>
                <p className="text-white/70 text-xs mt-1">экономия</p>
              </div>
              <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-2xl md:text-3xl font-extrabold text-white">100%</p>
                <p className="text-white/70 text-xs mt-1">безопасно</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      {/* ══════════════════════════════════════════
          OWNER CTA (тёмный)
      ══════════════════════════════════════════ */}
      <section className="py-24 relative overflow-hidden bg-[#2B2B2B]">
        <motion.div
          animate={{ scale: [1, 1.1, 1], x: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[#C65D3B]/10 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#4A8587]/10 blur-3xl pointer-events-none"
        />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#C65D3B]/15 text-[#E8854A] text-sm font-bold mb-6"
          >
            <TrendingUp className="w-4 h-4" />
            Для владельцев вещей
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-[1.1]"
          >
            У вас есть вещи,
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #C65D3B 0%, #E8854A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              которые пылятся?
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-lg text-white/70 mb-10 max-w-xl mx-auto"
          >
            Сдавайте в аренду и зарабатывайте. Гарантийный фонд и Цифровые акты надёжно защитят вашу вещь.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/auth?tab=register&role=owner"
              className="relative inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-[#C65D3B] text-white font-bold text-lg shadow-xl shadow-[#C65D3B]/30 hover:bg-[#a04829] hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              Стать владельцем
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/how-to-list"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:border-white/40 hover:bg-white/5 hover:-translate-y-1 transition-all duration-200"
            >
              Узнать подробности
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
