import bcrypt from "bcryptjs";
import {
  db,
  pool,
  usersTable,
  regionsTable,
  categoriesTable,
  listingsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seed: начало...");

  // ─── РЕГИОНЫ ──────────────────────────────────────────────────────────────
  const existingRegions = await db.select({ n: count() }).from(regionsTable);
  if (Number(existingRegions[0].n) === 0) {
    await db.insert(regionsTable).values([
      { name: "Москва",          slug: "moscow"       },
      { name: "Санкт-Петербург", slug: "spb"          },
      { name: "Новосибирск",     slug: "novosibirsk"  },
      { name: "Екатеринбург",    slug: "ekaterinburg" },
      { name: "Казань",          slug: "kazan"        },
      { name: "Нижний Новгород", slug: "nnov"         },
      { name: "Краснодар",       slug: "krasnodar"    },
    ]);
    console.log("✅ Регионы добавлены");
  } else {
    console.log("⏭️  Регионы уже есть, пропускаем");
  }

  // ─── КАТЕГОРИИ ────────────────────────────────────────────────────────────
  const existingCats = await db.select({ n: count() }).from(categoriesTable);
  if (Number(existingCats[0].n) === 0) {
    await db.insert(categoriesTable).values([
      { name: "Электроника",      slug: "electronics",  icon: "💻" },
      { name: "Спорт и туризм",   slug: "sports",       icon: "⛷️"  },
      { name: "Инструменты",      slug: "tools",        icon: "🔧" },
      { name: "Одежда и обувь",   slug: "clothing",     icon: "👗" },
      { name: "Детские товары",   slug: "kids",         icon: "🧸" },
      { name: "Авто и мото",      slug: "auto",         icon: "🚗" },
      { name: "Фото и видео",     slug: "photo",        icon: "📷" },
      { name: "Отдых и природа",  slug: "outdoor",      icon: "🏕️"  },
      { name: "Праздник и декор", slug: "decor",        icon: "🎉" },
      { name: "Книги и учёба",    slug: "books",        icon: "📚" },
    ]);
    console.log("✅ Категории добавлены");
  } else {
    console.log("⏭️  Категории уже есть, пропускаем");
  }

  // Подтягиваем ID регионов и категорий
  const regions    = await db.select().from(regionsTable);
  const categories = await db.select().from(categoriesTable);

  const r = (slug: string) => regions.find(x => x.slug === slug)!.id;
  const c = (slug: string) => categories.find(x => x.slug === slug)!.id;

  // ─── ПОЛЬЗОВАТЕЛИ ────────────────────────────────────────────────────────
  const existingUsers = await db.select({ n: count() }).from(usersTable);
  let ownerId1: number, ownerId2: number, ownerId3: number;

  if (Number(existingUsers[0].n) <= 1) {
    const hash = (pw: string) => bcrypt.hash(pw, 10);

    const [o1] = await db.insert(usersTable).values({
      name: "Алексей Петров",
      email: "alexey@example.com",
      passwordHash: await hash("Test1234!"),
      role: "owner",
      phone: "+7 (916) 123-45-67",
      regionId: r("moscow"),
      bio: "Сдаю технику и инструменты уже 3 года. Всё в отличном состоянии.",
      telegram: "@alexey_rents",
    }).returning();

    const [o2] = await db.insert(usersTable).values({
      name: "Мария Соколова",
      email: "maria@example.com",
      passwordHash: await hash("Test1234!"),
      role: "owner",
      phone: "+7 (812) 987-65-43",
      regionId: r("spb"),
      bio: "Фотограф. Сдаю профессиональное оборудование для съёмок.",
      telegram: "@maria_photo",
    }).returning();

    const [o3] = await db.insert(usersTable).values({
      name: "Дмитрий Захаров",
      email: "dmitry@example.com",
      passwordHash: await hash("Test1234!"),
      role: "owner",
      phone: "+7 (343) 555-44-33",
      regionId: r("ekaterinburg"),
      bio: "Сдаю спортивное снаряжение и товары для отдыха на природе.",
    }).returning();

    await db.insert(usersTable).values([
      {
        name: "Ирина Новикова",
        email: "irina@example.com",
        passwordHash: await hash("Test1234!"),
        role: "renter",
        phone: "+7 (963) 111-22-33",
        regionId: r("moscow"),
      },
      {
        name: "Сергей Волков",
        email: "sergey@example.com",
        passwordHash: await hash("Test1234!"),
        role: "renter",
        phone: "+7 (921) 444-55-66",
        regionId: r("spb"),
      },
      {
        name: "Анна Козлова",
        email: "anna@example.com",
        passwordHash: await hash("Test1234!"),
        role: "renter",
        phone: "+7 (383) 777-88-99",
        regionId: r("novosibirsk"),
      },
    ]);

    ownerId1 = o1.id;
    ownerId2 = o2.id;
    ownerId3 = o3.id;
    console.log("✅ Пользователи добавлены");
  } else {
    const owners = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "owner"))
      .limit(3);
    ownerId1 = owners[0]?.id ?? 1;
    ownerId2 = owners[1]?.id ?? 1;
    ownerId3 = owners[2]?.id ?? 1;
    console.log("⏭️  Пользователи уже есть, пропускаем");
  }

  // ─── ОБЪЯВЛЕНИЯ ──────────────────────────────────────────────────────────
  const existingListings = await db.select({ n: count() }).from(listingsTable);
  if (Number(existingListings[0].n) === 0) {
    await db.insert(listingsTable).values([
      // Электроника — Москва
      {
        title: "DJI Mini 3 Pro — дрон для аэросъёмки",
        description: "Квадрокоптер DJI Mini 3 Pro с камерой 4K/60fps. В комплекте 3 аккумулятора, зарядная станция, кейс для переноски. Идеален для путешествий и съёмки мероприятий.",
        pricePerDay: "2500",
        deposit: "15000",
        categoryId: c("electronics"),
        regionId: r("moscow"),
        city: "Москва",
        ownerId: ownerId1,
        isAvailable: true,
      },
      {
        title: "MacBook Pro 16\" M3 — ноутбук для работы",
        description: "Apple MacBook Pro 16 дюймов, чип M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Подходит для разработки, видеомонтажа, дизайна.",
        pricePerDay: "3000",
        deposit: "120000",
        categoryId: c("electronics"),
        regionId: r("moscow"),
        city: "Москва",
        ownerId: ownerId1,
        isAvailable: true,
      },
      {
        title: "Проектор Epson EB-X51 + экран",
        description: "Проектор 3600 люмен, разрешение XGA, поддержка HDMI и USB. Экран 120 дюймов в комплекте. Отлично подходит для конференций и домашнего кинотеатра.",
        pricePerDay: "1500",
        deposit: "10000",
        categoryId: c("electronics"),
        regionId: r("moscow"),
        city: "Москва",
        ownerId: ownerId1,
        isAvailable: true,
      },

      // Фото/видео — Санкт-Петербург
      {
        title: "Sony A7 IV + объектив 24-70mm",
        description: "Полнокадровая беззеркальная камера 33 МП. В комплекте объектив Sony 24-70mm f/2.8, 2 аккумулятора, зарядка, сумка.",
        pricePerDay: "3500",
        deposit: "80000",
        categoryId: c("photo"),
        regionId: r("spb"),
        city: "Санкт-Петербург",
        ownerId: ownerId2,
        isAvailable: true,
      },
      {
        title: "Осветительный комплект — 3 студийных моноблока",
        description: "Студийный свет: 3 моноблока по 400 Вт, 3 стойки, 2 зонта, 1 октабокс 80х80, синхронизатор. Для предметной и портретной съёмки.",
        pricePerDay: "2000",
        deposit: "20000",
        categoryId: c("photo"),
        regionId: r("spb"),
        city: "Санкт-Петербург",
        ownerId: ownerId2,
        isAvailable: true,
      },
      {
        title: "Стабилизатор DJI RS 3 для камеры",
        description: "3-осевой электронный стабилизатор для зеркальных и беззеркальных камер. Нагрузка до 3 кг. Bluetooth-управление.",
        pricePerDay: "800",
        deposit: "12000",
        categoryId: c("photo"),
        regionId: r("spb"),
        city: "Санкт-Петербург",
        ownerId: ownerId2,
        isAvailable: true,
      },

      // Спорт и туризм — Екатеринбург
      {
        title: "Горные лыжи Rossignol + ботинки (р. 43-44)",
        description: "Лыжи Rossignol React 6 170 см с креплениями Look SPX 12. Ботинки Rossignol Track 90 размер 43-44. Состояние хорошее.",
        pricePerDay: "700",
        deposit: "8000",
        categoryId: c("sports"),
        regionId: r("ekaterinburg"),
        city: "Екатеринбург",
        ownerId: ownerId3,
        isAvailable: true,
      },
      {
        title: "Туристическая палатка на 4 человека",
        description: "Трёхсезонная палатка MSR Habitude 4. Вес 3,5 кг, водостойкость 3000 мм. Внутренняя палатка, тент, дуги в комплекте.",
        pricePerDay: "600",
        deposit: "5000",
        categoryId: c("sports"),
        regionId: r("ekaterinburg"),
        city: "Екатеринбург",
        ownerId: ownerId3,
        isAvailable: true,
      },
      {
        title: "Велосипед горный Trek Marlin 7 (рама L)",
        description: "Горный байк 29 дюймов, рама L (рост 178-190 см), 21 скорость Shimano, гидравлические тормоза. Подходит для трейлов и городских поездок.",
        pricePerDay: "900",
        deposit: "25000",
        categoryId: c("sports"),
        regionId: r("ekaterinburg"),
        city: "Екатеринбург",
        ownerId: ownerId3,
        isAvailable: true,
      },

      // Инструменты — Москва
      {
        title: "Перфоратор Bosch GBH 2-26 + набор свёрл",
        description: "Профессиональный перфоратор Bosch 800 Вт, SDS-plus. Набор из 15 свёрл и бит в кейсе. Для бетона, кирпича, плитки.",
        pricePerDay: "400",
        deposit: "6000",
        categoryId: c("tools"),
        regionId: r("moscow"),
        city: "Москва",
        ownerId: ownerId1,
        isAvailable: true,
      },
      {
        title: "Лазерный уровень Bosch GLL 3-80",
        description: "3-плоскостной лазерный нивелир, 360°, дальность 30 м. В комплекте кейс, держатель RM 1, аккумуляторы.",
        pricePerDay: "500",
        deposit: "7000",
        categoryId: c("tools"),
        regionId: r("moscow"),
        city: "Москва",
        ownerId: ownerId1,
        isAvailable: true,
      },

      // Праздник и декор — Санкт-Петербург
      {
        title: "Шатёр 6×6 м для мероприятий",
        description: "Разборной шатёр белого цвета 6×6 метров. Высота 3 м. Вмещает до 30 человек. Боковые стенки в комплекте. Самовывоз или доставка.",
        pricePerDay: "2500",
        deposit: "10000",
        categoryId: c("decor"),
        regionId: r("spb"),
        city: "Санкт-Петербург",
        ownerId: ownerId2,
        isAvailable: true,
      },
      {
        title: "Фотобудка для вечеринки",
        description: "Готовая фотобудка: iPad, принтер, фон на выбор, реквизит. Печать фото за 10 секунд. Аренда на день включает монтаж и настройку.",
        pricePerDay: "5000",
        deposit: "15000",
        categoryId: c("decor"),
        regionId: r("spb"),
        city: "Санкт-Петербург",
        ownerId: ownerId2,
        isAvailable: true,
      },

      // Детские товары — Казань
      {
        title: "Детская коляска Bugaboo Fox 3",
        description: "Универсальная коляска 2в1: люлька + прогулочный блок. Подходит от рождения до 22 кг. Всесезонная, хорошее состояние.",
        pricePerDay: "350",
        deposit: "30000",
        categoryId: c("kids"),
        regionId: r("kazan"),
        city: "Казань",
        ownerId: ownerId3,
        isAvailable: true,
      },
    ]);
    console.log("✅ Объявления добавлены");
  } else {
    console.log("⏭️  Объявления уже есть, пропускаем");
  }

  console.log("🎉 Seed завершён!");
}

// Экспорт для вызова из admin-роута (без закрытия пула)
export default seed;

// Прямой запуск через CLI (ts-node/tsx) — закрываем пул после завершения
const isMain = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");
if (isMain) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error("❌ Seed упал с ошибкой:", err);
      process.exit(1);
    });
}
