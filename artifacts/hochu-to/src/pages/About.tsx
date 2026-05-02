import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { Heart, Globe, Recycle } from "lucide-react";
import { useDocumentMeta } from "@/lib/use-document-meta";

export default function About() {
  useDocumentMeta({
    title: "О нас",
    description: "ХочуТо — платформа аренды вещей с гарантийным фондом. Мы делаем шеринг-экономику доступной и безопасной для каждого.",
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold mb-6">О нас</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Мы верим, что доступ к вещам важнее владения ими. Наша миссия — сделать потребление разумным.
          </p>
        </div>

        <img src={`${import.meta.env.BASE_URL}images/about-team.png`} className="w-full h-[400px] object-cover rounded-3xl mb-16 shadow-xl" alt="Команда" />

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card p-8 rounded-3xl border border-border text-center">
            <Heart className="w-10 h-10 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3">Сообщество</h3>
            <p className="text-muted-foreground">Объединяем людей, готовых делиться и доверять друг другу.</p>
          </div>
          <div className="bg-card p-8 rounded-3xl border border-border text-center">
            <Recycle className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3">Экология</h3>
            <p className="text-muted-foreground">Продлеваем жизнь вещам и сокращаем перепроизводство.</p>
          </div>
          <div className="bg-card p-8 rounded-3xl border border-border text-center">
            <Globe className="w-10 h-10 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3">Масштаб</h3>
            <p className="text-muted-foreground">Растем и открываем новые регионы для удобного шеринга.</p>
          </div>
        </div>

        <div className="bg-primary/5 p-12 rounded-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Присоединяйтесь к нам</h2>
          <p className="text-lg text-muted-foreground mb-8">Станьте частью экономики совместного потребления уже сегодня.</p>
          <Link href="/auth?tab=register" className="btn-primary">Зарегистрироваться</Link>
        </div>
      </div>
    </Layout>
  );
}
