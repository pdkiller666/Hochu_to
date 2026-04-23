/**
 * Идемпотентная миграция + seed для продакшена.
 * Запускается в CMD Dockerfile ДО старта сервера.
 *
 * Шаги:
 *   0. drizzle-kit push --force — создаёт/синхронизирует ВСЕ таблицы из schema/
 *      (без этого шага на свежей БД Amvera ALTER TABLE падает с
 *       "relation does not exist" и контейнер не стартует).
 *   1. ALTER TABLE ... IF NOT EXISTS — безопасные структурные миграции.
 *   2. Seed справочников и demo-данных через ON CONFLICT DO NOTHING.
 */
import pg from "pg";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ════════════════════════════════════════════════════════════════════
// 0. СИНХРОНИЗАЦИЯ СХЕМЫ ЧЕРЕЗ DRIZZLE-KIT PUSH
// ════════════════════════════════════════════════════════════════════
console.log("[migrate] Step 0: drizzle-kit push --force (sync schema)");
const drizzleConfig = path.join(__dirname, "drizzle.config.ts");
const pushResult = spawnSync(
  "pnpm",
  ["exec", "drizzle-kit", "push", "--force", "--config", drizzleConfig],
  {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  },
);
if (pushResult.status !== 0) {
  console.error(`[migrate] drizzle-kit push failed (exit ${pushResult.status})`);
  process.exit(1);
}
console.log("[migrate] Step 0: schema synced");

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

// ════════════════════════════════════════════════════════════════════
// 1. СТРУКТУРНЫЕ МИГРАЦИИ (добавление колонок)
// ════════════════════════════════════════════════════════════════════
const migrations = [
  // listings
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS item_category text`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS max_protection_limit numeric(12,2)`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS requires_manual_verification boolean NOT NULL DEFAULT false`,
  // users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_deals_count integer NOT NULL DEFAULT 0`,
  // bookings
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS claim_status text`,
];

for (const sql of migrations) {
  try {
    await client.query(sql);
    console.log(`[migrate] OK: ${sql.slice(0, 80)}`);
  } catch (err) {
    // Не валим контейнер — drizzle push выше уже привёл схему в порядок,
    // а эти ALTER нужны только для обратной совместимости со старыми БД.
    console.error(`[migrate] WARN (non-fatal): ${err.message}`);
  }
}

console.log("[migrate] All schema migrations applied");

// ════════════════════════════════════════════════════════════════════
// 2. SEED: КАТЕГОРИИ
// ════════════════════════════════════════════════════════════════════
try {
  await client.query(`
    INSERT INTO categories (slug, name, icon) VALUES
      ('construction', 'Стройка и ремонт', '🔨'),
      ('tourism',      'Туризм и спорт',   '⛺'),
      ('garden',       'Сад и огород',     '🌱'),
      ('holidays',     'Праздники',         '🎉'),
      ('children',     'Детские товары',   '👶'),
      ('electronics',  'Электроника',       '💻'),
      ('auto',         'Авто и мото',       '🚗'),
      ('clothing',     'Одежда и обувь',    '👗'),
      ('photo',        'Фото и видео',      '📷'),
      ('books',        'Книги и учёба',     '📚')
    ON CONFLICT (slug) DO NOTHING
  `);
  console.log("[seed] categories OK");
} catch (err) {
  console.error(`[seed] categories ERROR: ${err.message}`);
}

// ════════════════════════════════════════════════════════════════════
// 3. SEED: РЕГИОНЫ (основные города России)
// ════════════════════════════════════════════════════════════════════
try {
  await client.query(`
    INSERT INTO regions (slug, name) VALUES
      ('moscow',       'Москва'),
      ('spb',          'Санкт-Петербург'),
      ('novosibirsk',  'Новосибирская область'),
      ('ekaterinburg', 'Свердловская область'),
      ('kazan',        'Республика Татарстан'),
      ('krasnodar',    'Краснодарский край'),
      ('nizhny-novgorod', 'Нижегородская область'),
      ('chelyabinsk',  'Челябинская область'),
      ('omsk',         'Омская область'),
      ('samara',       'Самарская область'),
      ('rostov',       'Ростовская область'),
      ('ufa',          'Республика Башкортостан'),
      ('voronezh',     'Воронежская область'),
      ('perm',         'Пермский край'),
      ('volgograd',    'Волгоградская область'),
      ('tyumen',       'Тюменская область'),
      ('saratov',      'Саратовская область'),
      ('khabarovsk',   'Хабаровский край'),
      ('irkutsk',      'Иркутская область'),
      ('vladivostok',  'Приморский край'),
      ('yaroslavl',    'Ярославская область'),
      ('tomsk',        'Томская область'),
      ('ryazan',       'Рязанская область'),
      ('penza',        'Пензенская область'),
      ('sevastopol',   'Севастополь'),
      ('crimea',       'Республика Крым'),
      ('bashkortostan','Республика Башкортостан'),
      ('tatarstan',    'Республика Татарстан'),
      ('sakha',        'Республика Саха (Якутия)'),
      ('adygea',       'Республика Адыгея'),
      ('altai-rep',    'Республика Алтай'),
      ('buryatia',     'Республика Бурятия'),
      ('dagestan',     'Республика Дагестан'),
      ('ingushetia',   'Республика Ингушетия'),
      ('kabardino-balkaria', 'Кабардино-Балкарская Республика'),
      ('kalmykia',     'Республика Калмыкия'),
      ('karachay-cherkessia', 'Карачаево-Черкесская Республика'),
      ('karelia',      'Республика Карелия'),
      ('komi',         'Республика Коми'),
      ('mari-el',      'Республика Марий Эл'),
      ('mordovia',     'Республика Мордовия'),
      ('north-ossetia','Республика Северная Осетия — Алания'),
      ('smolensk',     'Смоленская область'),
      ('tula',         'Тульская область'),
      ('tver',         'Тверская область'),
      ('murmansk',     'Мурманская область'),
      ('orenburg',     'Оренбургская область'),
      ('bryansk',      'Брянская область')
    ON CONFLICT (slug) DO NOTHING
  `);
  console.log("[seed] regions OK");
} catch (err) {
  console.error(`[seed] regions ERROR: ${err.message}`);
}

// ════════════════════════════════════════════════════════════════════
// 4. SEED: ПОЛЬЗОВАТЕЛИ-ВЛАДЕЛЬЦЫ (только если нет ни одного)
// ════════════════════════════════════════════════════════════════════
// Пароль для всех demo-аккаунтов: Demo1234!
const DEMO_HASH = "$2b$10$at3GCVE85pXVi4D.BVz9qO/x3ilpmRNBVASKYpEx8dkK9yzho7v4a";

try {
  await client.query(`
    INSERT INTO users (name, email, password_hash, role, phone, bio) VALUES
      ('Алексей Петров',  'alexey@example.com', $1, 'owner', '+7 (916) 123-45-67', 'Сдаю технику и инструменты. Всё в идеальном состоянии.'),
      ('Мария Соколова',  'maria@example.com',  $1, 'owner', '+7 (812) 234-56-78', 'Фотограф. Сдаю профессиональное оборудование.'),
      ('Дмитрий Захаров', 'dmitry@example.com', $1, 'owner', '+7 (343) 345-67-89', 'Активный образ жизни. Сдаю спортивный инвентарь.')
    ON CONFLICT (email) DO NOTHING
  `, [DEMO_HASH]);
  console.log("[seed] users OK");
} catch (err) {
  console.error(`[seed] users ERROR: ${err.message}`);
}

// ════════════════════════════════════════════════════════════════════
// 5. SEED: ОБЪЯВЛЕНИЯ (только если таблица пустая)
// ════════════════════════════════════════════════════════════════════
try {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM listings`);
  if (rows[0].cnt === 0) {
    await client.query(`
      INSERT INTO listings
        (listing_number, title, description, price_per_day, deposit, market_value,
         category_id, region_id, city, owner_id, photos, is_available, item_category)
      SELECT
        lst.listing_number,
        lst.title,
        lst.description,
        lst.price_per_day,
        lst.deposit,
        lst.market_value,
        (SELECT id FROM categories WHERE slug = lst.cat_slug),
        (SELECT id FROM regions    WHERE slug = lst.reg_slug),
        lst.city,
        (SELECT id FROM users      WHERE email = lst.owner_email),
        lst.photos,
        true,
        lst.item_cat
      FROM (VALUES
        ('L-0001','MacBook Pro 16" M3 — ноутбук для работы',
         'Apple MacBook Pro 16", чип M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки, видеомонтажа, дизайна.',
         3000, 120000, 180000, 'electronics', 'moscow', 'Москва', 'alexey@example.com', '{}', 'electronics'),

        ('L-0002','Проектор Epson + экран 120"',
         'Проектор 3600 люмен, HDMI + USB, экран 120" в комплекте. Для конференций и домашнего кино.',
         1500, 10000, 65000, 'electronics', 'moscow', 'Москва', 'alexey@example.com', '{}', 'electronics'),

        ('L-0003','Sony A7 IV + объектив 24-70mm f/2.8',
         'Полнокадровая беззеркалка 33 МП. Объектив Sony 24-70mm f/2.8, 2 акб, зарядка, сумка.',
         3500, 80000, 320000, 'photo', 'spb', 'Санкт-Петербург', 'maria@example.com', '{}', 'electronics'),

        ('L-0004','Студийный свет — 3 моноблока 400 Вт',
         'Студийный комплект: 3 моноблока, стойки, зонты, октабокс 80×80, синхронизатор.',
         2000, 20000, 95000, 'photo', 'spb', 'Санкт-Петербург', 'maria@example.com', '{}', 'electronics'),

        ('L-0005','Стабилизатор DJI RS 3 для камеры',
         '3-осевой гимбал, нагрузка до 3 кг, Bluetooth, для любых камер.',
         800, 12000, 42000, 'photo', 'spb', 'Санкт-Петербург', 'maria@example.com', '{}', 'electronics'),

        ('L-0006','Горные лыжи Rossignol + ботинки (р. 43-44)',
         'Лыжи Rossignol 170 см с креплениями Look SPX 12. Ботинки р.43-44. Состояние хорошее.',
         700, 8000, 28000, 'tourism', 'chelyabinsk', 'Челябинск', 'dmitry@example.com', '{}', 'leisure'),

        ('L-0007','Туристическая палатка на 4 человека',
         'Двухслойная палатка Naturehike Cloud-Up 4. Вес 2.8 кг, водостойкость 3000 мм.',
         400, 5000, 18000, 'tourism', 'novosibirsk', 'Новосибирск', 'dmitry@example.com', '{}', 'leisure'),

        ('L-0008','SUP-доска надувная 11 футов',
         'Полный комплект: доска, весло, насос, лиш, рюкзак. Грузоподъёмность до 120 кг.',
         900, 15000, 35000, 'tourism', 'krasnodar', 'Краснодар', 'dmitry@example.com', '{}', 'leisure'),

        ('L-0009','Перфоратор Bosch GBH 2-28 F',
         'Мощность 880 Вт, удар 3.2 Дж, патрон SDS+, реверс, три режима работы.',
         350, 4000, 12000, 'construction', 'moscow', 'Москва', 'alexey@example.com', '{}', 'tools'),

        ('L-0010','Лазерный уровень Bosch GLL 3-80',
         'Самовыравнивающийся лазер: 3 плоскости, дальность 30 м, кейс, штатив.',
         500, 6000, 22000, 'construction', 'moscow', 'Москва', 'alexey@example.com', '{}', 'tools'),

        ('L-0011','Фотобудка с принтером',
         'Профессиональная фотобудка: DSLR-камера, кольцевая вспышка, принтер моментальной печати, фоны.',
         5000, 30000, 150000, 'holidays', 'spb', 'Санкт-Петербург', 'maria@example.com', '{}', 'electronics'),

        ('L-0012','Детский велосипед 16" (рост 100-120 см)',
         'Велосипед STELS Jet 16 с боковыми колёсами, звонком и корзинкой. Состояние отличное.',
         200, 3000, 8000, 'children', 'moscow', 'Москва', 'alexey@example.com', '{}', 'leisure'),

        ('L-0013','Детская коляска Bugaboo Fox 3',
         'Всесезонная коляска 2-в-1. Люлька + прогулочный блок. Цвет: серый. В комплекте дождевик.',
         800, 20000, 80000, 'children', 'spb', 'Санкт-Петербург', 'maria@example.com', '{}', 'leisure')
      ) AS lst(listing_number, title, description, price_per_day, deposit, market_value,
               cat_slug, reg_slug, city, owner_email, photos, item_cat)
      WHERE
        (SELECT id FROM categories WHERE slug = lst.cat_slug) IS NOT NULL
        AND (SELECT id FROM regions  WHERE slug = lst.reg_slug) IS NOT NULL
        AND (SELECT id FROM users    WHERE email = lst.owner_email) IS NOT NULL
    `);
    console.log("[seed] listings OK — inserted demo listings");
  } else {
    console.log(`[seed] listings SKIP — table already has ${rows[0].cnt} rows`);
  }
} catch (err) {
  console.error(`[seed] listings ERROR: ${err.message}`);
}

await client.end();
console.log("[migrate] Done");
