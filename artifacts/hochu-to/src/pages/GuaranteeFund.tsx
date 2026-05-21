import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useDocumentMeta } from "@/lib/use-document-meta";
import {
  Shield, ShieldCheck, Camera, FileCheck2, Sparkles, Bot,
  ArrowRight, AlertTriangle, Wrench, CheckCircle2, XCircle,
  Coins, Clock, Eye, Fingerprint, MapPin, ChevronRight,
  Star, Zap, Lock, Users,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const CHIPS = [
  { icon: Shield,      label: "Взаимопомощь",  cls: "bg-white/20 border-white/40 text-white shadow-[0_4px_16px_rgba(255,255,255,0.15)]" },
  { icon: Camera,      label: "Цифровые акты", cls: "bg-[#4A8587]/80 border-[#4A8587] text-white shadow-[0_4px_16px_rgba(74,133,135,0.5)]" },
  { icon: Bot,         label: "ИИ-арбитраж",   cls: "bg-violet-500/80 border-violet-400 text-white shadow-[0_4px_16px_rgba(139,92,246,0.5)]" },
  { icon: Fingerprint, label: "Эл. подпись",   cls: "bg-amber-500/80 border-amber-400 text-white shadow-[0_4px_16px_rgba(245,158,11,0.5)]" },
];

const STATS = [
  { value: "5%", label: "взнос владельца", sub: "от стоимости аренды" },
  { value: "5%", label: "взнос арендатора", sub: "опциональная защита" },
  { value: "4+", label: "фото на передаче", sub: "с GPS и подписью" },
  { value: "ИИ", label: "арбитраж споров", sub: "Gemini Vision" },
];

const FUND_STEPS = [
  {
    num: "01",
    accent: "#C65D3B",
    icon: Coins,
    title: "Формирование фонда",
    desc: "При каждой успешной аренде владелец и арендатор перечисляют по 5% в общий фонд взаимопомощи. Взносы прозрачны и отображаются в итоговой стоимости.",
  },
  {
    num: "02",
    accent: "#4A8587",
    icon: FileCheck2,
    title: "Цифровой акт фиксирует состояние",
    desc: "До и после аренды обе стороны оформляют Цифровой акт: минимум 4 фото, GPS-координаты, опциональное видео и обязательная электронная подпись.",
  },
  {
    num: "03",
    accent: "#8E6B2B",
    icon: Bot,
    title: "ИИ-арбитраж при споре",
    desc: "Если возник спор — Gemini Vision сравнивает фото передачи и возврата, определяет характер ущерба и выносит взвешенный вердикт.",
  },
  {
    num: "04",
    accent: "#6B3FA0",
    icon: ShieldCheck,
    title: "Компенсация из фонда",
    desc: "Если залога недостаточно и арендатор виновен — фонд возмещает ущерб владельцу. Естественный износ фондом не покрывается — это риск владельца.",
  },
];

const ARBITRATION_CATS = [
  {
    letter: "А",
    icon: Eye,
    color: "from-amber-50 to-orange-50 border-amber-200",
    accent: "#D97706",
    title: "Визуальный ущерб",
    subtitle: "Царапины, сколы, деформации",
    resolution: "Удерживается из залога немедленно по фото-сравнению",
    ok: ["Царапина на экране", "Скол корпуса", "Трещина детали"],
    fund: false,
  },
  {
    letter: "Б",
    icon: Wrench,
    color: "from-blue-50 to-indigo-50 border-blue-200",
    accent: "#2563EB",
    title: "Техническая поломка",
    subtitle: "Требует диагностики в сервис-центре",
    resolution: "Независимая экспертиза определяет причину",
    ok: ["Не включается", "Сломан механизм", "Повреждена электроника"],
    fund: true,
  },
];

const CLAIM_STEPS = [
  { icon: FileCheck2,  title: "Оформите оба акта",       desc: "Check-in при получении вещи и check-out при возврате. Без актов — претензия невозможна." },
  { icon: AlertTriangle, title: "Подайте заявку",        desc: "В разделе Дашборд → История броней → кнопка «Подать заявку в фонд». Опишите ущерб, приложите доп. фото." },
  { icon: Bot,          title: "ИИ-проверка",            desc: "Gemini Vision анализирует фото check-in vs check-out и формирует предварительный вердикт." },
  { icon: ShieldCheck,  title: "Решение арбитра",        desc: "Модератор изучает вердикт ИИ и материалы дела. При необходимости — ручная проверка в сервис-центре." },
  { icon: Coins,        title: "Выплата",                desc: "Одобренная сумма переводится на ваши реквизиты. Срок — до 7 рабочих дней после решения." },
];

const LIMITS = [
  { icon: Lock,  label: "Резервный фонд",       desc: "Часть баланса неприкосновенна — платформа не выплачивает более X% от текущего баланса." },
  { icon: Users, label: "Лимит заявок в месяц", desc: "Не более N обоснованных заявок на одного пользователя в календарный месяц." },
  { icon: Star,  label: "Лимит суммы",          desc: "Максимальная выплата по одной заявке ограничена и привязана к стоимости вещи." },
  { icon: Zap,   label: "Антифрод ИИ",          desc: "Gemini Vision и система аудита выявляют нечестные паттерны — подозрительные профили блокируются." },
];

export default function GuaranteeFund() {
  useDocumentMeta({
    title: "Гарантийный фонд — APEX Protection",
    description: "Система защиты Хочу_То: взаимный фонд, Цифровые акты с подписью и GPS, ИИ-арбитраж Gemini Vision. Сдавайте спокойно — арендуйте уверенно.",
  });

  return (
    <Layout>
      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-[#6B2020] via-[#C65D3B] to-[#8E3F23]">
        {/* Animated blobs */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-80px] right-[-120px] w-[550px] h-[550px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          className="absolute bottom-[-60px] left-[-100px] w-[450px] h-[450px] rounded-full bg-[#4A8587]/20 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-1/2 left-1/4 w-[700px] h-[250px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        {/* Dot pattern */}
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
            <ShieldCheck className="w-4 h-4 fill-white/80" />
            APEX · Asset Protection & Escrow eXchange
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6 text-white"
          >
            Сдавай спокойно.{" "}
            <br className="hidden sm:block" />
            <span
              style={{
                background: "linear-gradient(135deg, #FBEDE7 0%, #F8C9A8 50%, #FBEDE7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Арендуй уверенно.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Гарантийный фонд — не страховка, а программа взаимопомощи. Каждый участник вносит
            небольшой взнос, а платформа выступает независимым арбитром через Цифровые акты и ИИ.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link
              href="/catalog"
              className="relative inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white text-[#C65D3B] font-bold text-lg shadow-xl shadow-black/20 hover:bg-white/90 hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-[#C65D3B]/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Sparkles className="w-5 h-5" />
              Смотреть каталог
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
            {CHIPS.map(({ icon: Icon, label, cls }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold backdrop-blur transition-transform hover:scale-105 ${cls}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════ STATS BAR ══════════════════════ */}
      <section className="py-8 bg-white border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map(({ value, label, sub }, i) => (
              <motion.div
                key={label}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="flex flex-col gap-0.5"
              >
                <span className="font-display text-4xl md:text-5xl font-extrabold text-primary leading-none">{value}</span>
                <span className="text-sm font-bold text-foreground mt-1">{label}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ HOW IT WORKS ══════════════════════ */}
      <section id="how-it-works" className="py-20 md:py-28 bg-[#F2EEE3]">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Shield className="w-3.5 h-3.5" /> Механика фонда
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold text-foreground mb-4">
              Как работает<br /><span className="text-primary">Гарантийный фонд</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Четыре этапа от взноса до компенсации — прозрачно и автоматизировано.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FUND_STEPS.map(({ num, accent, icon: Icon, title, desc }, i) => (
              <motion.div
                key={num}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="bg-white rounded-3xl p-7 shadow-sm border border-border/40 flex gap-5 hover:shadow-md transition-shadow"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                  style={{ background: `${accent}18` }}
                >
                  <Icon className="w-7 h-7" style={{ color: accent }} />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: accent }}>{num}</div>
                  <h3 className="font-bold text-base text-foreground mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ DIGITAL ACT ══════════════════════ */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-xs font-bold uppercase tracking-wider mb-5">
                <FileCheck2 className="w-3.5 h-3.5" /> Цифровой акт
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground mb-5">
                Сделка начинается<br /><span className="text-[#4A8587]">только с актом</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-8">
                Цифровой акт — это защищённая фиксация состояния вещи в момент передачи.
                Без него платформа не переводит сделку в статус «Активна». Это ваш главный
                инструмент доказательства при любом споре.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Camera,      text: "Минимум 4 фото с разных ракурсов" },
                  { icon: MapPin,      text: "GPS-координаты из EXIF-данных фото" },
                  { icon: Fingerprint, text: "Электронная подпись пальцем или мышью" },
                  { icon: FileCheck2,  text: "Опциональное видео состояния вещи" },
                  { icon: Lock,        text: "Иммутабельная запись — изменить нельзя" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#4A8587]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#4A8587]" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
              className="relative"
            >
              <div className="bg-gradient-to-br from-[#4A8587] to-[#2e6566] rounded-3xl p-8 text-white shadow-2xl shadow-[#4A8587]/30 relative overflow-hidden">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 5, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none"
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Цифровой акт</div>
                      <div className="text-white/60 text-xs">check-in · 21 мая 2026</div>
                    </div>
                    <div className="ml-auto px-2.5 py-1 bg-emerald-400/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold">Подписан</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {["Фото 1/4", "Фото 2/4", "Фото 3/4", "Фото 4/4"].map((f) => (
                      <div key={f} className="aspect-[4/3] rounded-xl bg-white/10 flex items-center justify-center text-xs text-white/50 font-medium border border-white/10">
                        <Camera className="w-5 h-5 mr-1.5 opacity-50" />{f}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">GPS</span>
                      <span className="font-mono text-xs">55.7558° N, 37.6173° E</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Подпись</span>
                      <span className="text-emerald-300 font-bold text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Получена</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Статус</span>
                      <span className="text-emerald-300 font-bold text-xs">Иммутабельно сохранён</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ ARBITRATION CATEGORIES ══════════════════════ */}
      <section className="py-20 md:py-28 bg-[#F2EEE3]">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider mb-4">
              <AlertTriangle className="w-3.5 h-3.5" /> Ступенчатый арбитраж
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold text-foreground mb-4">
              Два типа споров —<br /><span className="text-primary">разные правила</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Не все поломки одинаковы. Платформа разделяет ущерб по категориям и применяет
              соответствующий порядок разрешения.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {ARBITRATION_CATS.map(({ letter, icon: Icon, color, accent, title, subtitle, resolution, ok, fund }, i) => (
              <motion.div
                key={letter}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className={`bg-gradient-to-br ${color} rounded-3xl p-8 border`}
              >
                <div className="flex items-start gap-4 mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: `${accent}18` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: accent }} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: accent }}>
                      Категория {letter}
                    </div>
                    <h3 className="font-bold text-lg text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                  </div>
                </div>

                <div className="bg-white/60 backdrop-blur rounded-2xl p-4 mb-5 border border-white/80">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Решение</p>
                  <p className="text-sm font-medium text-foreground">{resolution}</p>
                </div>

                <div className="space-y-2 mb-5">
                  {ok.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                      {item}
                    </div>
                  ))}
                </div>

                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: `${accent}15`, color: accent }}
                >
                  {fund ? (
                    <><CheckCircle2 className="w-4 h-4" /> Фонд участвует при доказанной вине</>
                  ) : (
                    <><XCircle className="w-4 h-4" style={{ color: "#D97706" }} /> Покрывается залогом (без фонда)</>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Natural wear note */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-8 bg-white border border-border/50 rounded-2xl p-5 flex gap-4"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">Естественный износ</span> фондом не покрывается — это риск владельца.
              Платформа возмещает только ущерб, причинённый по вине арендатора, подтверждённый актами и арбитражем.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════ AI ARBITRATION ══════════════════════ */}
      <section className="py-20 md:py-28 bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Visual card */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="relative order-2 lg:order-1"
            >
              <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl p-8 text-white shadow-2xl overflow-hidden">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none"
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Gemini Vision Арбитраж</div>
                      <div className="text-white/50 text-xs">анализ ущерба · заявка #ХТ-2026-000042</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Check-in</div>
                      <div className="aspect-video rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1.5 font-medium">Без повреждений</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Check-out</div>
                      <div className="aspect-video rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      </div>
                      <div className="text-[10px] text-red-400 mt-1.5 font-medium">Обнаружены царапины</div>
                    </div>
                  </div>

                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                      <span className="text-xs font-bold text-violet-300">Вердикт ИИ</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Обнаружены новые царапины на левой боковой панели. Ущерб соответствует категории А.
                      Рекомендую: удержать из залога 2 400 ₽.
                    </p>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-[10px] text-white/40">Уверенность</span>
                      <span className="text-xs font-bold text-violet-300">94%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
              className="order-1 lg:order-2"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-5">
                <Bot className="w-3.5 h-3.5" /> ИИ-арбитраж
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground mb-5">
                Gemini Vision<br /><span className="text-violet-600">сравнивает фото</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">
                При споре модель Google Gemini Vision анализирует фотографии из акта передачи
                и акта возврата. Она выявляет новые повреждения, оценивает их характер
                и рекомендует сумму компенсации — всё автоматически.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Eye,          text: "Визуальное сравнение 8+ фото" },
                  { icon: Bot,          text: "Мгновенная классификация ущерба" },
                  { icon: ShieldCheck,  text: "Кэшированный вердикт — не изменить задним числом" },
                  { icon: Users,        text: "Финальное решение за арбитром платформы" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-violet-600" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ CLAIM STEPS ══════════════════════ */}
      <section className="py-20 md:py-28 bg-[#F2EEE3]">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Coins className="w-3.5 h-3.5" /> Подача заявки
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold text-foreground mb-4">
              Как получить<br /><span className="text-primary">компенсацию</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-7 top-8 bottom-8 w-px bg-border hidden md:block" />
            <div className="space-y-4">
              {CLAIM_STEPS.map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  className="flex gap-5 bg-white rounded-2xl p-5 border border-border/40 shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 relative z-10">
                    <Icon className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-0.5">Шаг {i + 1}</div>
                    <h3 className="font-bold text-base text-foreground mb-0.5">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ LIMITS / ANTI-FRAUD ══════════════════════ */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4">
              <Lock className="w-3.5 h-3.5" /> Защита фонда
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold text-foreground mb-4">
              Прозрачные правила,<br /><span className="text-emerald-600">сильный антифрод</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Чтобы фонд оставался справедливым — мы устанавливаем разумные лимиты и следим за аномальными паттернами.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {LIMITS.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-6 flex gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-1">{label}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ CTA ══════════════════════ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#C65D3B] via-[#a04829] to-[#8E3F23] relative overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <ShieldCheck className="w-16 h-16 text-white/30 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-white mb-5 leading-tight">
              Всё готово для<br />защищённой аренды
            </h2>
            <p className="text-white/70 text-lg mb-10 leading-relaxed">
              Добавьте вещь — и каждая аренда будет защищена Цифровым актом, залогом и Гарантийным фондом.
              Сдавайте без страха потери.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard/listings/new"
                className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white text-[#C65D3B] font-bold text-lg shadow-xl shadow-black/20 hover:bg-white/90 hover:-translate-y-1 transition-all duration-200"
              >
                <Sparkles className="w-5 h-5" />
                Сдать вещь в аренду
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white/10 border-2 border-white/25 text-white font-bold text-lg hover:bg-white/20 hover:-translate-y-1 transition-all duration-200"
              >
                Смотреть каталог
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
