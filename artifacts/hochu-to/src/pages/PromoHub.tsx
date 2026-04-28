import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileCheck2,
  Sparkles,
  TrendingUp,
  Users,
  Crown,
  Gift,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.8, ease: "easeOut" as const },
};

function CTAButtons() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link
        href="/catalog"
        className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-[#C65D3B] text-white font-semibold text-lg shadow-lg shadow-[#C65D3B]/20 hover:bg-[#a04829] hover:shadow-xl hover:shadow-[#C65D3B]/30 hover:-translate-y-0.5 transition-all"
        data-testid="link-promo-catalog"
      >
        Смотреть каталог
        <ArrowRight className="w-5 h-5" />
      </Link>
      <Link
        href="/joint-purchases"
        className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white border-2 border-[#C65D3B] text-[#C65D3B] font-semibold text-lg shadow-sm hover:bg-[#C65D3B] hover:text-white hover:-translate-y-0.5 transition-all"
        data-testid="link-promo-joint"
      >
        Начать совместную покупку
      </Link>
    </div>
  );
}

export default function PromoHub() {
  return (
    <Layout>
      <main className="overflow-x-hidden">
        {/* ─── СЕКЦИЯ 1: КРЮЧОК — БЕЗОПАСНАЯ АРЕНДА ────────────────────────── */}
        <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#F2EEE3] via-[#F2EEE3] to-[#FBEDE7]">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-[#C65D3B]/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[#4A8587]/10 blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <motion.div {...fadeIn}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur border border-[#C65D3B]/20 text-sm text-[#8E3F23] font-medium mb-8">
                <Sparkles className="w-4 h-4" />
                Маркетплейс безопасной аренды
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp}
              className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-6 text-foreground"
            >
              Берите дорогие вещи{" "}
              <span className="text-[#C65D3B]">без страха и залогов</span>.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Платформа «Хочу_То» защищает каждую сделку Цифровым актом и Рейтингом доверия.
              Никаких бумажных договоров и сомнительных переписок — только прозрачные условия и
              проверенные люди.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-14"
            >
              <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-border text-left shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-[#E8F0F0] flex items-center justify-center mb-4">
                  <FileCheck2 className="w-6 h-6 text-[#2F5C5E]" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">Цифровые акты</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Каждая аренда фиксируется электронным актом с фото, подписями и условиями. Если
                  что-то пошло не так — есть на что сослаться.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-border text-left shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-[#FBEDE7] flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#C65D3B]" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">Рейтинг доверия</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Динамический индекс от 0 до 100 на основе отзывов, верификации и истории
                  сделок. Видно сразу, с кем безопасно иметь дело.
                </p>
              </div>
            </motion.div>

            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
              <CTAButtons />
            </motion.div>
          </div>
        </section>

        {/* ─── СЕКЦИЯ 2: ПЕРЕХОД — ОТ ПОТРЕБИТЕЛЯ К ВЛАДЕЛЬЦУ ──────────────── */}
        <section className="py-20 md:py-32 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4A8587]/10 text-[#4A8587] text-sm font-medium mb-6">
                <TrendingUp className="w-4 h-4" />
                Следующий шаг
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">
                А что если вещь будет{" "}
                <span className="text-[#4A8587]">работать на вас?</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Дрель, электросамокат, проектор — всё, чем вы пользуетесь раз в месяц, может
                окупать само себя. Превратитесь из арендатора во владельца, который зарабатывает.
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl p-8 bg-gradient-to-br from-[#F2EEE3] to-white border border-border">
                <div className="text-4xl font-display font-extrabold text-[#C65D3B] mb-3">01</div>
                <h3 className="font-display font-bold text-lg mb-2">Опубликуйте вещь</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Загрузите фото и описание — встроенный ИИ-помощник подготовит текст за минуту.
                </p>
              </div>
              <div className="rounded-2xl p-8 bg-gradient-to-br from-[#F2EEE3] to-white border border-border">
                <div className="text-4xl font-display font-extrabold text-[#C65D3B] mb-3">02</div>
                <h3 className="font-display font-bold text-lg mb-2">Принимайте брони</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Каждый бронирующий проходит верификацию и виден его Рейтинг доверия. Решение
                  всегда за вами.
                </p>
              </div>
              <div className="rounded-2xl p-8 bg-gradient-to-br from-[#F2EEE3] to-white border border-border">
                <div className="text-4xl font-display font-extrabold text-[#C65D3B] mb-3">03</div>
                <h3 className="font-display font-bold text-lg mb-2">Получайте оплату</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  P2P-переводы напрямую через СБП. Никаких комиссий-«посредников» в режиме беты.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── СЕКЦИЯ 3: KILLER FEATURE — СОВМЕСТНЫЕ ПОКУПКИ ────────────────── */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-[#FBEDE7] via-[#F2EEE3] to-[#F2EEE3]">
          <div className="max-w-6xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C65D3B] text-white text-sm font-bold mb-6 shadow-md shadow-[#C65D3B]/20">
                <Sparkles className="w-4 h-4" />
                Главная фишка платформы
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">
                Совместная покупка —{" "}
                <span className="text-[#C65D3B]">когда вещь общая</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Не хочется платить полную цену за то, чем пользуешься несколько раз в году?
                Объединитесь с соседями, друзьями или незнакомцами и купите вещь вскладчину.
                Каждый владеет долей и получает доступ.
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-[#C65D3B] text-white font-display font-extrabold flex items-center justify-center shadow-md">
                  1
                </div>
                <Users className="w-8 h-8 text-[#C65D3B] mb-4 mt-2" />
                <h3 className="font-display font-bold text-lg mb-2">Присоединиться</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Найдите Пул на интересную вещь или создайте свой. Внесите долю — она
                  автоматически фиксируется в Цифровом акте.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-[#C65D3B] text-white font-display font-extrabold flex items-center justify-center shadow-md">
                  2
                </div>
                <Crown className="w-8 h-8 text-[#C65D3B] mb-4 mt-2" />
                <h3 className="font-display font-bold text-lg mb-2">Выбрать Хранителя</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Совладельцы голосуют, у кого вещь будет физически храниться. Хранитель отвечает
                  за состояние и передачу другим участникам.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-[#C65D3B] text-white font-display font-extrabold flex items-center justify-center shadow-md">
                  3
                </div>
                <Gift className="w-8 h-8 text-[#C65D3B] mb-4 mt-2" />
                <h3 className="font-display font-bold text-lg mb-2">Пользоваться без оплаты</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Своя доля — свой доступ. Бронируете дни через календарь Пула и забираете вещь
                  у Хранителя. Никаких арендных платежей внутри Пула.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border relative">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-[#C65D3B] text-white font-display font-extrabold flex items-center justify-center shadow-md">
                  4
                </div>
                <ArrowRightLeft className="w-8 h-8 text-[#C65D3B] mb-4 mt-2" />
                <h3 className="font-display font-bold text-lg mb-2">Выйти или выкупить</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Передумали? Продайте свою долю другому участнику. Хотите единолично владеть?
                  Сделайте Buyout — выкупите остальные доли по счётчику износа.
                </p>
              </div>
            </motion.div>

            <motion.div {...fadeUp} className="text-center">
              <CTAButtons />
            </motion.div>
          </div>
        </section>

        {/* ─── ФИНАЛЬНЫЙ CTA + ПРАВОВЫЕ ССЫЛКИ ──────────────────────────────── */}
        <section className="py-16 md:py-24 bg-white border-t border-border">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <motion.h2
              {...fadeUp}
              className="font-display text-2xl md:text-4xl font-bold leading-tight mb-4"
            >
              Готовы попробовать разумное потребление?
            </motion.h2>
            <motion.p
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="text-muted-foreground text-lg mb-10 leading-relaxed"
            >
              Регистрация занимает минуту. Никаких подписок и скрытых платежей в режиме беты.
            </motion.p>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
              <CTAButtons />
            </motion.div>

            <motion.p
              {...fadeIn}
              className="text-sm text-muted-foreground mt-12"
            >
              Регистрируясь, вы соглашаетесь с{" "}
              <Link href="/terms" className="text-[#C65D3B] hover:underline font-medium">
                Пользовательским соглашением
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="text-[#C65D3B] hover:underline font-medium">
                Политикой конфиденциальности
              </Link>
              .
            </motion.p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
