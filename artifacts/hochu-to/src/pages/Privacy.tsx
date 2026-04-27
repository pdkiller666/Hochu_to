import { Layout } from "@/components/layout/Layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-10 pb-8 border-b border-border">
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-3">
            Политика конфиденциальности
          </h1>
          <p className="text-muted-foreground">
            Последнее обновление: {new Date().toLocaleDateString("ru-RU")}
          </p>
        </header>

        <article className="space-y-10 text-base leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">1. Сбор информации</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Мы собираем информацию, которую вы предоставляете при регистрации, включая имя,
                email и номер телефона. Также мы собираем данные об использовании платформы для
                улучшения сервиса.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">2. Использование данных</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Ваши данные используются исключительно для обеспечения работы платформы: связи
                между арендаторами и владельцами, верификации и безопасности транзакций.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-4">3. Защита данных</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Мы применяем современные технологии шифрования для защиты вашей личной
                информации. Мы не передаём ваши данные третьим лицам в рекламных целях.
              </p>
            </div>
          </section>
        </article>
      </div>
    </Layout>
  );
}
