import bcrypt from "bcryptjs";
import {
  db,
  pool,
  usersTable,
  regionsTable,
  categoriesTable,
  listingsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ─── ВСЕ 85 СУБЪЕКТОВ РОССИЙСКОЙ ФЕДЕРАЦИИ ───────────────────────────────────
const ALL_REGIONS = [
  // Федеральные города
  { name: "Москва",                                slug: "moscow"               },
  { name: "Санкт-Петербург",                       slug: "spb"                  },
  { name: "Севастополь",                           slug: "sevastopol"           },
  // Республики
  { name: "Республика Адыгея",                     slug: "adygea"               },
  { name: "Республика Алтай",                      slug: "altai-rep"            },
  { name: "Республика Башкортостан",               slug: "bashkortostan"        },
  { name: "Республика Бурятия",                    slug: "buryatia"             },
  { name: "Республика Дагестан",                   slug: "dagestan"             },
  { name: "Республика Ингушетия",                  slug: "ingushetia"           },
  { name: "Кабардино-Балкарская Республика",       slug: "kabardino-balkaria"   },
  { name: "Республика Калмыкия",                   slug: "kalmykia"             },
  { name: "Карачаево-Черкесская Республика",       slug: "karachay-cherkessia"  },
  { name: "Республика Карелия",                    slug: "karelia"              },
  { name: "Республика Коми",                       slug: "komi"                 },
  { name: "Республика Крым",                       slug: "crimea"               },
  { name: "Республика Марий Эл",                   slug: "mari-el"              },
  { name: "Республика Мордовия",                   slug: "mordovia"             },
  { name: "Республика Саха (Якутия)",              slug: "sakha"                },
  { name: "Республика Северная Осетия — Алания",  slug: "north-ossetia"        },
  { name: "Республика Татарстан",                  slug: "tatarstan"            },
  { name: "Республика Тыва",                       slug: "tuva"                 },
  { name: "Удмуртская Республика",                 slug: "udmurtia"             },
  { name: "Республика Хакасия",                    slug: "khakassia"            },
  { name: "Чеченская Республика",                  slug: "chechnya"             },
  { name: "Чувашская Республика",                  slug: "chuvashia"            },
  // Края
  { name: "Алтайский край",                        slug: "altai-krai"           },
  { name: "Забайкальский край",                    slug: "zabaykalsky"          },
  { name: "Камчатский край",                       slug: "kamchatka"            },
  { name: "Краснодарский край",                    slug: "krasnodar"            },
  { name: "Красноярский край",                     slug: "krasnoyarsk"          },
  { name: "Пермский край",                         slug: "perm"                 },
  { name: "Приморский край",                       slug: "primorsky"            },
  { name: "Ставропольский край",                   slug: "stavropol"            },
  { name: "Хабаровский край",                      slug: "khabarovsk"           },
  // Области
  { name: "Амурская область",                      slug: "amur"                 },
  { name: "Архангельская область",                 slug: "arkhangelsk"          },
  { name: "Астраханская область",                  slug: "astrakhan"            },
  { name: "Белгородская область",                  slug: "belgorod"             },
  { name: "Брянская область",                      slug: "bryansk"              },
  { name: "Владимирская область",                  slug: "vladimir"             },
  { name: "Волгоградская область",                 slug: "volgograd"            },
  { name: "Вологодская область",                   slug: "vologda"              },
  { name: "Воронежская область",                   slug: "voronezh"             },
  { name: "Ивановская область",                    slug: "ivanovo"              },
  { name: "Иркутская область",                     slug: "irkutsk"              },
  { name: "Калининградская область",               slug: "kaliningrad"          },
  { name: "Калужская область",                     slug: "kaluga"               },
  { name: "Кемеровская область",                   slug: "kemerovo"             },
  { name: "Кировская область",                     slug: "kirov"                },
  { name: "Костромская область",                   slug: "kostroma"             },
  { name: "Курганская область",                    slug: "kurgan"               },
  { name: "Курская область",                       slug: "kursk"                },
  { name: "Ленинградская область",                 slug: "leningrad-obl"        },
  { name: "Липецкая область",                      slug: "lipetsk"              },
  { name: "Магаданская область",                   slug: "magadan"              },
  { name: "Московская область",                    slug: "moscow-obl"           },
  { name: "Мурманская область",                    slug: "murmansk"             },
  { name: "Нижегородская область",                 slug: "nizhny-novgorod"      },
  { name: "Новгородская область",                  slug: "novgorod-obl"         },
  { name: "Новосибирская область",                 slug: "novosibirsk"          },
  { name: "Омская область",                        slug: "omsk"                 },
  { name: "Оренбургская область",                  slug: "orenburg"             },
  { name: "Орловская область",                     slug: "oryol"                },
  { name: "Пензенская область",                    slug: "penza"                },
  { name: "Псковская область",                     slug: "pskov"                },
  { name: "Ростовская область",                    slug: "rostov"               },
  { name: "Рязанская область",                     slug: "ryazan"               },
  { name: "Самарская область",                     slug: "samara"               },
  { name: "Саратовская область",                   slug: "saratov"              },
  { name: "Сахалинская область",                   slug: "sakhalin"             },
  { name: "Свердловская область",                  slug: "sverdlovsk"           },
  { name: "Смоленская область",                    slug: "smolensk"             },
  { name: "Тамбовская область",                    slug: "tambov"               },
  { name: "Тверская область",                      slug: "tver"                 },
  { name: "Томская область",                       slug: "tomsk"                },
  { name: "Тульская область",                      slug: "tula"                 },
  { name: "Тюменская область",                     slug: "tyumen"               },
  { name: "Ульяновская область",                   slug: "ulyanovsk"            },
  { name: "Челябинская область",                   slug: "chelyabinsk"          },
  { name: "Ярославская область",                   slug: "yaroslavl"            },
  // Автономная область
  { name: "Еврейская автономная область",          slug: "jewish-ao"            },
  // Автономные округа
  { name: "Ненецкий автономный округ",             slug: "nenets"               },
  { name: "Ханты-Мансийский автономный округ",     slug: "khanty-mansiysk"      },
  { name: "Чукотский автономный округ",            slug: "chukotka"             },
  { name: "Ямало-Ненецкий автономный округ",       slug: "yamal"                },
];

// ─── КАТЕГОРИИ (совпадают со slug на главной странице) ────────────────────────
const ALL_CATEGORIES = [
  { name: "Стройка и ремонт", slug: "construction", icon: "🔨" },
  { name: "Туризм и спорт",   slug: "tourism",      icon: "⛺" },
  { name: "Сад и огород",     slug: "garden",       icon: "🌱" },
  { name: "Праздники",        slug: "holidays",     icon: "🎉" },
  { name: "Детские товары",   slug: "children",     icon: "👶" },
  { name: "Электроника",      slug: "electronics",  icon: "💻" },
  { name: "Авто и мото",      slug: "auto",         icon: "🚗" },
  { name: "Одежда и обувь",   slug: "clothing",     icon: "👗" },
  { name: "Фото и видео",     slug: "photo",        icon: "📷" },
  { name: "Книги и учёба",    slug: "books",        icon: "📚" },
];

async function seed() {
  console.log("🌱 Seed: начало...");

  // ─── ШАГ 1: ЧИСТИМ ОБЪЯВЛЕНИЯ И КАТЕГОРИИ (каскадно) ─────────────────────
  console.log("🗑️  Очищаем объявления...");
  await db.delete(listingsTable);

  console.log("🗑️  Очищаем категории...");
  await db.delete(categoriesTable);

  console.log("🗑️  Очищаем регионы...");
  await db.execute(sql`UPDATE users SET region_id = NULL WHERE region_id IS NOT NULL`);
  await db.delete(regionsTable);

  // ─── ШАГ 2: РЕГИОНЫ — все 85 субъектов РФ ────────────────────────────────
  await db.insert(regionsTable).values(ALL_REGIONS);
  console.log(`✅ Регионы добавлены (${ALL_REGIONS.length} шт.)`);

  // ─── ШАГ 3: КАТЕГОРИИ ─────────────────────────────────────────────────────
  await db.insert(categoriesTable).values(ALL_CATEGORIES);
  console.log(`✅ Категории добавлены (${ALL_CATEGORIES.length} шт.)`);

  // Получаем свежие ID
  const regions    = await db.select().from(regionsTable);
  const categories = await db.select().from(categoriesTable);

  const r = (slug: string) => {
    const found = regions.find(x => x.slug === slug);
    if (!found) throw new Error(`Region not found: ${slug}`);
    return found.id;
  };
  const c = (slug: string) => {
    const found = categories.find(x => x.slug === slug);
    if (!found) throw new Error(`Category not found: ${slug}`);
    return found.id;
  };

  // ─── ШАГ 4: ОБНОВЛЯЕМ РЕГИОН СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ ─────────────────
  await db.execute(sql`
    UPDATE users SET region_id = ${r("moscow")} WHERE region_id IS NULL
  `);
  console.log("✅ Регион пользователей обновлён → Москва");

  // ─── ШАГ 5: ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ (только если нет) ─────────────────────
  const existingUsers = await db.select({ n: sql<number>`count(*)::int` }).from(usersTable);
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
      regionId: r("sverdlovsk"),
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
      {
        name: "Администратор",
        email: "admin@test.ru",
        passwordHash: await hash("Admin1234!"),
        role: "admin",
        phone: "+7 (000) 000-00-00",
        regionId: r("moscow"),
      },
    ]);

    ownerId1 = o1.id;
    ownerId2 = o2.id;
    ownerId3 = o3.id;
    console.log("✅ Тестовые пользователи добавлены");
  } else {
    const owners = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "owner"))
      .limit(3);
    ownerId1 = owners[0]?.id ?? 1;
    ownerId2 = owners[1]?.id ?? 1;
    ownerId3 = owners[2]?.id ?? 1;
    console.log("⏭️  Пользователи уже есть");
  }

  // ─── ШАГ 6: ОБЪЯВЛЕНИЯ ───────────────────────────────────────────────────
  await db.insert(listingsTable).values([
    // Электроника — Москва
    {
      title: "DJI Mini 3 Pro — дрон для аэросъёмки",
      description: "Квадрокоптер DJI Mini 3 Pro с камерой 4K/60fps. В комплекте 3 аккумулятора, зарядная станция, кейс. Идеален для путешествий и съёмки мероприятий.",
      pricePerDay: "2500", deposit: "15000", marketValue: "150000",
      categoryId: c("electronics"), regionId: r("moscow"), city: "Москва",
      ownerId: ownerId1, isAvailable: true,
    },
    {
      title: "MacBook Pro 16\" M3 — ноутбук для работы",
      description: "Apple MacBook Pro 16\", чип M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки, видеомонтажа, дизайна.",
      pricePerDay: "3000", deposit: "120000", marketValue: "1200000",
      categoryId: c("electronics"), regionId: r("moscow"), city: "Москва",
      ownerId: ownerId1, isAvailable: true,
    },
    {
      title: "Проектор Epson + экран 120\"",
      description: "Проектор 3600 люмен, HDMI + USB, экран 120\" в комплекте. Для конференций и домашнего кино.",
      pricePerDay: "1500", deposit: "10000", marketValue: "100000",
      categoryId: c("electronics"), regionId: r("moscow"), city: "Москва",
      ownerId: ownerId1, isAvailable: true,
    },
    // Фото и видео — Санкт-Петербург
    {
      title: "Sony A7 IV + объектив 24-70mm f/2.8",
      description: "Полнокадровая беззеркалка 33 МП. Объектив Sony 24-70mm f/2.8, 2 акб, зарядка, сумка.",
      pricePerDay: "3500", deposit: "80000", marketValue: "800000",
      categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург",
      ownerId: ownerId2, isAvailable: true,
    },
    {
      title: "Студийный свет — 3 моноблока 400 Вт",
      description: "Студийный комплект: 3 моноблока, стойки, зонты, октабокс 80×80, синхронизатор.",
      pricePerDay: "2000", deposit: "20000", marketValue: "200000",
      categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург",
      ownerId: ownerId2, isAvailable: true,
    },
    {
      title: "Стабилизатор DJI RS 3 для камеры",
      description: "3-осевой гимбал, нагрузка до 3 кг, Bluetooth, для любых камер.",
      pricePerDay: "800", deposit: "12000", marketValue: "120000",
      categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург",
      ownerId: ownerId2, isAvailable: true,
    },
    // Туризм и спорт — Свердловская область
    {
      title: "Горные лыжи Rossignol + ботинки (р. 43-44)",
      description: "Лыжи Rossignol 170 см с креплениями Look SPX 12. Ботинки р.43-44. Состояние хорошее.",
      pricePerDay: "700", deposit: "8000", marketValue: "80000",
      categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург",
      ownerId: ownerId3, isAvailable: true,
    },
    {
      title: "Туристическая палатка на 4 человека",
      description: "MSR Habitude 4, вес 3,5 кг, водостойкость 3000 мм. Трёхсезонная.",
      pricePerDay: "600", deposit: "5000", marketValue: "50000",
      categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург",
      ownerId: ownerId3, isAvailable: true,
    },
    {
      title: "SUP-доска надувная 11 футов",
      description: "Доска для сапсёрфинга с веслом, насосом и рюкзаком. Для рек, озёр, водохранилищ.",
      pricePerDay: "900", deposit: "6000", marketValue: "60000",
      categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург",
      ownerId: ownerId3, isAvailable: true,
    },
    // Стройка и ремонт — Москва
    {
      title: "Перфоратор Bosch GBH 2-28 F",
      description: "Мощный перфоратор 880 Вт, удар 3,2 Дж, 3 режима, SDS-plus. Набор бит в комплекте.",
      pricePerDay: "500", deposit: "3000", marketValue: "30000",
      categoryId: c("construction"), regionId: r("moscow"), city: "Москва",
      ownerId: ownerId1, isAvailable: true,
    },
    {
      title: "Лазерный уровень Bosch GLL 3-80",
      description: "3-плоскостной самовыравнивающийся лазерный нивелир, дальность 80 м, штатив в комплекте.",
      pricePerDay: "700", deposit: "5000", marketValue: "50000",
      categoryId: c("construction"), regionId: r("moscow"), city: "Москва",
      ownerId: ownerId1, isAvailable: true,
    },
    // Праздники — Санкт-Петербург
    {
      title: "Фотобудка с принтером",
      description: "Автоматическая фотобудка: камера, принтер, реквизит, фоны. Печать за 10 сек. Для свадеб и корпоративов.",
      pricePerDay: "5000", deposit: "30000", marketValue: "300000",
      categoryId: c("holidays"), regionId: r("spb"), city: "Санкт-Петербург",
      ownerId: ownerId2, isAvailable: true,
    },
    // Детские товары — Республика Татарстан
    {
      title: "Детский велосипед 16\" (рост 100-120 см)",
      description: "Велосипед с боковыми колёсами, регулируемое сиденье и руль. Возраст 4-7 лет.",
      pricePerDay: "200", deposit: "2000", marketValue: "20000",
      categoryId: c("children"), regionId: r("tatarstan"), city: "Казань",
      ownerId: ownerId3, isAvailable: true,
    },
    {
      title: "Детская коляска Bugaboo Fox 3",
      description: "Универсальная 2в1: люлька + прогулочный блок. От рождения до 22 кг, всесезонная.",
      pricePerDay: "350", deposit: "30000", marketValue: "300000",
      categoryId: c("children"), regionId: r("tatarstan"), city: "Казань",
      ownerId: ownerId3, isAvailable: true,
    },
  ]);
  console.log("✅ Объявления добавлены (14 шт.)");

  console.log("🎉 Seed завершён!");
}

export default seed;

const isMain = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.mjs") || process.argv[1]?.endsWith("seed.js");
if (isMain) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error("❌ Seed упал с ошибкой:", err);
      process.exit(1);
    });
}
