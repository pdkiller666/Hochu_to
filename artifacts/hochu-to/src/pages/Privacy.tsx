import { Layout } from "@/components/layout/Layout";
import { useDocumentMeta } from "@/lib/use-document-meta";

export default function Privacy() {
  useDocumentMeta({
    title: "Политика конфиденциальности",
    description: "Политика конфиденциальности платформы ХочуТо. Как мы собираем, используем и защищаем ваши персональные данные.",
    noindex: true,
  });
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-10 pb-8 border-b border-border">
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-3">
            Политика конфиденциальности платформы «Хочу_То»
          </h1>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Версия 1.1 (Бета-режим).</strong>{" "}
            Дата вступления в силу: 28 апреля 2026 г.
          </p>
        </header>

        <article className="space-y-10 text-base leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              1. Общие положения и согласие
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Настоящая Политика описывает, какие персональные данные собирает и обрабатывает
                Платформа «Хочу_То» (далее — Платформа), а также для каких целей и на каких
                основаниях это происходит.
              </p>
              <p>
                Регистрируясь на Платформе или продолжая её использование, вы подтверждаете, что
                ознакомились с настоящей Политикой и даёте согласие на обработку своих
                персональных данных в соответствии с Федеральным законом № 152-ФЗ
                «О персональных данных».
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              2. Какие данные мы собираем
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                <strong className="text-foreground">Регистрационные данные:</strong> имя, адрес
                электронной почты, номер телефона, пароль (в зашифрованном виде).
              </p>
              <p>
                <strong className="text-foreground">Профильные данные:</strong> аватар, регион,
                сведения о верификации, список объявлений, история сделок и отзывов, рейтинг
                владельца/арендатора, динамический Рейтинг доверия (Trust Score).
              </p>
              <p>
                <strong className="text-foreground">Технические данные:</strong> IP-адрес,
                идентификаторы устройства, тип браузера, журналы посещений и действий —
                необходимы для безопасности и предотвращения мошенничества.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              3. Цели обработки данных
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Данные используются исключительно для обеспечения работы сервиса: связи между
                арендаторами и владельцами, формирования и фиксации Цифровых актов, расчёта
                Рейтинга доверия и долей в Пулах совместных покупок.
              </p>
              <p>
                Платформа не передаёт ваши контактные данные третьим лицам в рекламных целях и
                не продаёт базы пользователей.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              4. Защита и хранение данных
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Пароли хранятся в виде криптографических хэшей (bcrypt) и не доступны даже
                администрации Платформы. Доступ к базе данных ограничен и контролируется журналом
                событий (audit log).
              </p>
              <p>
                Сроки хранения определяются целью обработки: данные профиля и история сделок
                сохраняются всё время существования аккаунта; технические журналы — до 12 месяцев,
                после чего обезличиваются или удаляются.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              5. Cookies и аналитика
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Платформа использует технические cookies, необходимые для авторизации и
                сохранения пользовательских настроек (например, выбранный регион).
              </p>
              <p>
                Аналитические cookies применяются в обезличенном виде для улучшения интерфейса и
                не позволяют идентифицировать конкретного пользователя.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">
              6. Ваши права как субъекта персональных данных
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Вы вправе в любой момент: получить информацию об обрабатываемых данных, изменить
                или удалить их, отозвать согласие на обработку, а также удалить свой аккаунт.
              </p>
              <p>
                Запросы по защите персональных данных направляйте через раздел «Контакты». Срок
                ответа — не более 30 дней с момента получения обращения.
              </p>
            </div>
          </section>
        </article>
      </div>
    </Layout>
  );
}
