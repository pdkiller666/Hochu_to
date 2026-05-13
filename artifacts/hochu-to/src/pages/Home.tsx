import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { Hammer, Tent, Trees, PartyPopper, Baby, Laptop, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useGetCategories } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { ListingCarouselSection } from "@/components/ui/ListingCarouselSection";
import { useDocumentMeta } from "@/lib/use-document-meta";

const POPULAR_CATEGORIES = [
  { name: "Стройка и ремонт", icon: Hammer, slug: "construction", color: "bg-orange-100 text-orange-600" },
  { name: "Туризм и спорт", icon: Tent, slug: "tourism", color: "bg-teal-100 text-teal-600" },
  { name: "Сад и огород", icon: Trees, slug: "garden", color: "bg-green-100 text-green-600" },
  { name: "Праздники", icon: PartyPopper, slug: "holidays", color: "bg-purple-100 text-purple-600" },
  { name: "Детские товары", icon: Baby, slug: "children", color: "bg-pink-100 text-pink-600" },
  { name: "Электроника", icon: Laptop, slug: "electronics", color: "bg-blue-100 text-blue-600" },
];

export default function Home() {
  const { data: categories } = useGetCategories();

  useDocumentMeta({
    title: "Аренда вещей рядом с вами",
    description: "ХочуТо — платформа аренды вещей с гарантийным фондом. Инструменты, техника, туристическое снаряжение — арендуйте безопасно и выгодно.",
  });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Счастливые люди делятся вещами" 
            className="w-full h-full object-cover opacity-20 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              Зачем покупать, <br/>
              <span className="text-primary relative inline-block">
                если можно арендовать?
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-accent/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round" />
                </svg>
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-10 leading-relaxed"
            >
              Крупнейший маркетплейс аренды вещей от людей к людям. Инструменты, туристическое снаряжение, техника — найдите всё, что нужно, прямо сейчас.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Link href="/catalog" className="btn-primary py-4 px-10 text-lg rounded-2xl">
                Смотреть каталог
              </Link>
              <Link href="/auth?tab=register" className="btn-secondary py-4 px-10 text-lg rounded-2xl">
                Сдать вещь в аренду
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* M-3: Категории — горизонтальный скролл (Avito-style) */}
      <div className="bg-background border-b border-border/50 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex gap-2 overflow-x-auto py-2.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
            {POPULAR_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={`/catalog?category=${cat.slug}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white hover:border-primary hover:text-primary text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
                >
                  <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", cat.color)}>
                    <Icon className="w-3 h-3" />
                  </div>
                  {cat.name}
                </Link>
              );
            })}
            <Link
              href="/catalog"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm hover:bg-primary/90 transition-colors"
            >
              Все →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Маркетинговые карусели ── */}

      {/* 1. Хиты аренды */}
      <ListingCarouselSection
        title="Хиты"
        subtitle="Самые востребованные вещи на платформе"
        icon="🔥"
        badge={{ label: "ТОП", className: "bg-orange-100 text-orange-600" }}
        sort="popular"
        catalogLink="/catalog?sort=popular"
        bgClassName="bg-background"
      />

      {/* 2. Новинки */}
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

      {/* 3. Высокий рейтинг */}
      <ListingCarouselSection
        title="Высокий рейтинг"
        subtitle="Вещи с лучшими отзывами арендаторов"
        icon="⭐"
        badge={{ label: "4.5+", className: "bg-amber-100 text-amber-700" }}
        sort="rating"
        catalogLink="/catalog?sort=rating"
        bgClassName="bg-background"
      />

      {/* 4. Выгодные предложения */}
      <ListingCarouselSection
        title="Выгодные предложения"
        subtitle="Арендуй дешевле — экономь больше"
        icon="💸"
        badge={{ label: "ВЫГОДА", className: "bg-green-100 text-green-700" }}
        sort="price_asc"
        catalogLink="/catalog?sort=price_asc"
        bgClassName="bg-white"
      />

      {/* ──────────────────────────── */}

      {/* Popular Categories */}
      <section className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Популярные категории</h2>
            <p className="text-muted-foreground">От стройки до праздников — у нас есть всё</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {POPULAR_CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <Link 
                  key={cat.slug} 
                  href={`/catalog?category=${cat.slug}`}
                  className="group flex flex-col items-center p-3 sm:p-6 rounded-2xl bg-white border border-border/50 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 text-center"
                >
                  <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-2 sm:mb-4 transition-transform group-hover:scale-110", cat.color)}>
                    <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm">{cat.name}</h3>
                </Link>
              );
            })}
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/catalog" className="btn-secondary">
              Смотреть все категории
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">Как работает Хочу_То?</h2>
            <p className="text-muted-foreground text-lg">Всё очень просто и безопасно</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-border z-0"></div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-card shadow-xl flex items-center justify-center text-3xl font-display font-bold text-primary mb-6 border-4 border-white">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Найдите нужную вещь</h3>
              <p className="text-muted-foreground">Воспользуйтесь удобным поиском или каталогом, выберите даты в календаре.</p>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-card shadow-xl flex items-center justify-center text-3xl font-display font-bold text-primary mb-6 border-4 border-white">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">Оформите заявку</h3>
              <p className="text-muted-foreground">Владелец подтвердит бронирование, и вы получите его контакты для связи.</p>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary shadow-xl shadow-primary/30 flex items-center justify-center text-white mb-6 border-4 border-white">
                <Heart className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-3">Пользуйтесь и возвращайте</h3>
              <p className="text-muted-foreground">Заберите вещь, решите свою задачу и верните владельцу. Оставьте честный отзыв!</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary z-0"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0 mix-blend-overlay"></div>
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center text-white">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-6">У вас есть вещи, которые пылятся без дела?</h2>
          <p className="text-base sm:text-xl text-white/80 mb-8 sm:mb-10">
            Сдавайте их в аренду и получайте пассивный доход! Наша система взаимопомощи и гарантийный фонд защитят ваши интересы.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?tab=register&role=owner" className="btn-secondary w-full sm:w-auto text-lg text-primary hover:text-primary">
              Стать владельцем
            </Link>
            <Link href="/how-to-list" className="btn-accent w-full sm:w-auto text-lg bg-teal-600 hover:bg-teal-500 border-none">
              Узнать подробности
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
