import { Layout } from "@/components/layout/Layout";
import { Shield, CheckCircle, Info } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Instructions() {
  const [location] = useLocation();
  const isRent = location === "/how-to-rent";
  const isList = location === "/how-to-list";
  const isFund = location === "/guarantee-fund";

  if (isFund) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <img src={`${import.meta.env.BASE_URL}images/guarantee.png`} alt="Гарантийный фонд" className="w-64 h-64 object-cover mx-auto mb-8 rounded-full border-8 border-card shadow-2xl" />
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">Гарантийный фонд</h1>
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
            Система взаимопомощи Хочу_То защищает владельцев от непредвиденных поломок. С каждой успешной аренды мы отчисляем 5% в общий фонд. В случае порчи имущества арендатором и его отказе возмещать ущерб, фонд компенсирует затраты на ремонт владельцу.
          </p>
          <div className="bg-accent/10 border border-accent/20 p-8 rounded-3xl text-left flex gap-4">
            <Shield className="w-8 h-8 text-accent shrink-0" />
            <div>
              <h3 className="font-bold text-xl text-accent mb-2">Безопасность — наш приоритет</h3>
              <p className="text-muted-foreground">Все пользователи проходят верификацию. Внутренняя система рейтингов отсеивает недобросовестных участников.</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const steps = isRent ? [
    { title: "Найдите вещь", desc: "Используйте поиск и фильтры по категориям и вашему городу." },
    { title: "Выберите даты", desc: "Укажите период в календаре бронирования на странице вещи." },
    { title: "Оставьте заявку", desc: "Владелец получит уведомление и подтвердит бронь." },
    { title: "Заберите и пользуйтесь", desc: "Свяжитесь с владельцем, внесите залог (если требуется) и заберите вещь." },
  ] : [
    { title: "Зарегистрируйтесь как Владелец", desc: "Пройдите быструю верификацию номера телефона." },
    { title: "Добавьте объявление", desc: "Сделайте качественное фото, опишите вещь и установите цену за сутки." },
    { title: "Подтверждайте брони", desc: "Вам будут приходить запросы от проверенных арендаторов." },
    { title: "Зарабатывайте", desc: "Передавайте вещь по договору (шаблон предоставляем) и получайте доход." },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-extrabold mb-4 text-center">
          {isRent ? "Как арендовать вещь" : "Как сдать вещь в аренду"}
        </h1>
        <p className="text-center text-muted-foreground mb-16 text-lg">Простые шаги для безопасной и выгодной сделки.</p>

        <div className="space-y-8">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-6 items-start bg-card p-6 md:p-8 rounded-3xl border border-border">
              <div className="w-12 h-12 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                {i + 1}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-lg">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href={isRent ? "/catalog" : "/auth?tab=register&role=owner"} className="btn-primary text-lg py-4 px-10">
            {isRent ? "Перейти в каталог" : "Начать зарабатывать"}
          </Link>
        </div>
      </div>
    </Layout>
  );
}
