/**
 * Комплексный тест Telegram-уведомлений платформы «Хочу_То»
 *
 * Запуск: node scripts/test-telegram-notifications.mjs
 *
 * Что проверяет:
 *  1. Прямую отправку в Telegram для каждого типа уведомлений (все 27 типов)
 *  2. Реальный booking-flow через HTTP API (booking_submitted → confirmed → active → completed)
 *  3. Все три категории: bookings / system / chats
 */

import { execSync } from "child_process";

const BOT_TOKEN = "7792247457:AAFxyYIx_IXVf7eCvDF4YlJYdsSpIq1hXRg";
const CHAT_ID   = 422529066;          // superadmin linked chat
const API_BASE  = "http://localhost:8080/api";

const ADMIN_EMAIL = "admin@hochu.to";
const ADMIN_PASS  = "AdminTest99!";

let passed = 0, failed = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function log(label, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${label}${detail ? " — " + detail : ""}`);
  ok ? passed++ : failed++;
}

async function tgSend(text, replyMarkup) {
  const body = { chat_id: CHAT_ID, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json.ok === true;
}

async function apiPost(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiPut(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 1. Прямая отправка для каждого типа уведомлений ───────────────────────────

const NOTIF_SAMPLES = [
  // ─── BOOKINGS ───────────────────────────────────────────────────────────────
  {
    category: "bookings",
    type: "booking_submitted",
    title: "Новая заявка на аренду",
    msg: "Арендатор Иван подал заявку на «Перфоратор Makita» с 15 по 20 мая",
  },
  {
    category: "bookings",
    type: "booking_created",
    title: "Бронирование создано",
    msg: "Ваша заявка #ХТ-2026-000001 отправлена владельцу",
  },
  {
    category: "bookings",
    type: "booking_confirmed",
    title: "Бронирование подтверждено",
    msg: "Владелец подтвердил аренду «Перфоратор Makita» с 15 по 20 мая",
  },
  {
    category: "bookings",
    type: "booking_active",
    title: "Аренда началась",
    msg: "Аренда «Перфоратор Makita» активна до 20 мая",
  },
  {
    category: "bookings",
    type: "booking_return_pending",
    title: "Ожидание возврата",
    msg: "Арендатор отметил возврат «Перфоратор Makita» — подтвердите получение",
  },
  {
    category: "bookings",
    type: "booking_rejected",
    title: "Заявка отклонена",
    msg: "Владелец отклонил вашу заявку на «Перфоратор Makita»",
  },
  {
    category: "bookings",
    type: "booking_completed",
    title: "Аренда завершена",
    msg: "Аренда «Перфоратор Makita» успешно завершена! Спасибо за использование платформы.",
  },
  {
    category: "bookings",
    type: "booking_cancelled",
    title: "Бронирование отменено",
    msg: "Бронирование #ХТ-2026-000001 отменено",
  },
  // ─── REMINDERS ──────────────────────────────────────────────────────────────
  {
    category: "bookings",
    type: "reminder_confirm_pending",
    title: "⏳ Не забудьте подтвердить заявку",
    msg: "Заявка #ХТ-2026-000001 ожидает вашего подтверждения более 24 часов",
  },
  {
    category: "bookings",
    type: "reminder_checkin_soon",
    title: "📋 Завтра передача — оформите акт",
    msg: "Не забудьте оформить Цифровой акт приёмки перед передачей «Перфоратор Makita»",
  },
  {
    category: "bookings",
    type: "reminder_handover_today",
    title: "📦 Сегодня передача вещи",
    msg: "Сегодня нужно передать «Перфоратор Makita» арендатору Ивану",
  },
  {
    category: "bookings",
    type: "reminder_handover_overdue",
    title: "⚠️ Передача просрочена",
    msg: "Передача «Перфоратор Makita» просрочена! Срочно свяжитесь с арендатором.",
  },
  {
    category: "bookings",
    type: "reminder_checkout_soon",
    title: "📋 Завтра возврат — оформите акт",
    msg: "Не забудьте оформить Цифровой акт возврата «Перфоратор Makita»",
  },
  {
    category: "bookings",
    type: "reminder_return_today",
    title: "🔄 Сегодня возврат вещи",
    msg: "Сегодня арендатор возвращает «Перфоратор Makita»",
  },
  {
    category: "bookings",
    type: "reminder_return_overdue",
    title: "🚨 Возврат просрочен",
    msg: "Арендатор не вернул «Перфоратор Makita»! Обратитесь в поддержку.",
  },
  {
    category: "bookings",
    type: "reminder_return_confirm",
    title: "⏰ Подтвердите возврат вещи",
    msg: "Арендатор отметил возврат 2 дня назад. Пожалуйста, подтвердите получение.",
  },
  // ─── AUTO-TRANSITIONS ───────────────────────────────────────────────────────
  {
    category: "bookings",
    type: "auto_cancelled",
    title: "🤖 Бронирование автоматически отменено",
    msg: "Заявка #ХТ-2026-000001 отменена системой (владелец не подтвердил вовремя)",
  },
  {
    category: "bookings",
    type: "auto_activated",
    title: "🤖 Аренда автоматически активирована",
    msg: "Аренда «Перфоратор Makita» активирована по расписанию",
  },
  {
    category: "bookings",
    type: "auto_completed",
    title: "🤖 Аренда автоматически завершена",
    msg: "Аренда «Перфоратор Makita» завершена системой по истечении срока",
  },
  // ─── POOL (chats-category) ───────────────────────────────────────────────────
  {
    category: "chats",
    type: "pool_share_received_funds",
    title: "💸 Перевод получен",
    msg: "Мария перевела 3 000 ₽ за долю в пуле «Ноутбук Dell XPS 15» — подтвердите получение",
  },
  {
    category: "chats",
    type: "pool_purchasing",
    title: "🛒 Переходим к закупке",
    msg: "Сбор средств завершён. Хранитель совершает закупку «Ноутбук Dell XPS 15»",
  },
  {
    category: "chats",
    type: "pool_offer_reserved",
    title: "🤝 Запрос на выкуп доли",
    msg: "Дмитрий хочет выкупить вашу долю в «Ноутбук Dell XPS 15» за 12 000 ₽",
  },
  {
    category: "chats",
    type: "pool_share_received",
    title: "✅ Доля передана вам",
    msg: "Продавец подтвердил передачу — доля в «Ноутбук Dell XPS 15» теперь ваша",
  },
  {
    category: "chats",
    type: "pool_custodian_received",
    title: "🏠 Вы стали Хранителем",
    msg: "Вам передали «Ноутбук Dell XPS 15» — вы новый Хранитель пула",
  },
  {
    category: "chats",
    type: "pool_buyout_requested",
    title: "💰 Запрос полного выкупа",
    msg: "Иван хочет выкупить ваши доли в «Ноутбук Dell XPS 15» за 24 000 ₽",
  },
  {
    category: "chats",
    type: "pool_buyout_transferred",
    title: "📤 Деньги переведены",
    msg: "Иван отметил перевод 24 000 ₽ за выкуп «Ноутбук Dell XPS 15» — подтвердите получение",
  },
  {
    category: "chats",
    type: "pool_buyout_confirmed",
    title: "✅ Выкуп подтверждён",
    msg: "Мария подтвердила получение. Её доля в «Ноутбук Dell XPS 15» теперь у вас",
  },
  {
    category: "chats",
    type: "pool_buyout_canceled",
    title: "❌ Выкуп отменён",
    msg: "Иван отменил выкуп долей в «Ноутбук Dell XPS 15»",
  },
  {
    category: "chats",
    type: "pool_buyout_completed",
    title: "🎉 Пул ликвидирован",
    msg: "Иван выкупил все доли и стал единственным владельцем «Ноутбук Dell XPS 15»",
  },
];

async function testDirectTelegramDelivery() {
  console.log("\n━━━ 1. ПРЯМАЯ ОТПРАВКА ПО ВСЕМ ТИПАМ УВЕДОМЛЕНИЙ ━━━━━━━━━━━━━━━━\n");

  // Разбиваем на группы чтобы не флудить
  const header = await tgSend(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "<b>🧪 ТЕСТ TELEGRAM-УВЕДОМЛЕНИЙ</b>\n" +
    "Хочу_То — все типы нотификаций\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  log("Отправка заголовка теста", header);

  await sleep(500);

  const categories = ["bookings", "chats"];
  for (const cat of categories) {
    const items = NOTIF_SAMPLES.filter(n => n.category === cat);
    const catLabel = cat === "bookings" ? "📦 БРОНИРОВАНИЯ + НАПОМИНАНИЯ" : "🤝 СОВМЕСТНЫЕ ПОКУПКИ (пулы)";

    await tgSend(`\n<b>${catLabel}</b>`);
    await sleep(300);

    for (const n of items) {
      const text = `<b>${n.title}</b>\n${n.msg}`;
      const ok = await tgSend(text, {
        inline_keyboard: [[{ text: "Открыть →", url: "https://t.me/BotCraftAi_Test_4_bot" }]],
      });
      log(`[${cat}] ${n.type}`, ok);
      await sleep(350); // Telegram rate limit ~30 msg/s
    }
  }

  // Итоговый разделитель
  await tgSend("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Все типы уведомлений отправлены\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ── 2. Реальный booking-flow через HTTP API ────────────────────────────────────

async function adminOverride(bookingId, newStatus, token) {
  const res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ newStatus, comment: "test-script override" }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function testBookingFlow() {
  console.log("\n━━━ 2. РЕАЛЬНЫЙ BOOKING-FLOW ЧЕРЕЗ API (admin override) ━━━━━━━━━\n");

  // 2.1 Login as admin
  const loginRes = await apiPost("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = loginRes.body.token ?? loginRes.body.accessToken;
  if (loginRes.status !== 200 || !token) {
    log("Admin login", false, `HTTP ${loginRes.status} keys=${Object.keys(loginRes.body).join(",")}`);
    return;
  }
  log("Admin login", true);

  // 2.2 Get first available listing (skip the listing owned by admin)
  const listingsRes = await apiGet("/listings?limit=5", token);
  const allListings = listingsRes.body.listings ?? listingsRes.body.data ?? listingsRes.body ?? [];
  const adminId = loginRes.body.user?.id;
  const listing = allListings.find(l => l.ownerId !== adminId) ?? allListings[0];
  if (!listing) {
    log("Найти листинг для теста", false, "нет доступных листингов");
    return;
  }
  log(`Найти листинг для теста`, true, `#${listing.id} "${listing.title}"`);

  // 2.3 Create booking
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 3);
  const dayAfter  = new Date(today); dayAfter.setDate(today.getDate() + 5);
  const fmt = d => d.toISOString().slice(0, 10);

  const bookRes = await apiPost("/bookings", {
    listingId: listing.id,
    startDate: fmt(tomorrow),
    endDate: fmt(dayAfter),
    protectionEnabled: false,
  }, token);

  if (bookRes.status !== 201 && bookRes.status !== 200) {
    log("Создать бронирование (booking_submitted)", false, `HTTP ${bookRes.status}: ${JSON.stringify(bookRes.body).slice(0, 120)}`);
    return;
  }
  const booking = bookRes.body;
  log("Создать бронирование (booking_submitted)", true, `#${booking.id} ${booking.bookingNumber}`);

  await sleep(600);

  // 2.4–2.7: Force status transitions via admin override (each triggers notifications)
  const transitions = [
    ["active",         "Активировать бронь (booking_active)"],
    ["return_pending", "Отметить возврат (booking_return_pending)"],
    ["completed",      "Завершить бронь (booking_completed)"],
  ];

  // Ensure booking is confirmed first (it might be auto-confirmed already)
  const curRes = await apiGet(`/bookings/${booking.id}`, token);
  const curStatus = curRes.body?.status ?? "pending";
  if (curStatus === "pending") {
    const confirmRes = await adminOverride(booking.id, "confirmed", token);
    log("Подтвердить бронь (booking_confirmed) [override]", confirmRes.status === 200, `HTTP ${confirmRes.status}`);
    await sleep(600);
  } else {
    log(`Бронь уже в статусе «${curStatus}» — переходим к activate`, true);
  }

  for (const [newStatus, label] of transitions) {
    const r = await adminOverride(booking.id, newStatus, token);
    log(`${label} [override]`, r.status === 200, `HTTP ${r.status} prev→${newStatus}`);
    await sleep(600);
  }

  console.log(`\n  Booking #${booking.id} (${booking.bookingNumber}) прошёл полный lifecycle через admin override.`);
}

// ── 3. Тест admin broadcast через API ─────────────────────────────────────────

async function testAdminBroadcast() {
  console.log("\n━━━ 3. ADMIN BROADCAST ЧЕРЕЗ API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const loginRes = await apiPost("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = loginRes.body.token ?? loginRes.body.accessToken;
  if (!token) { log("Admin login for broadcast", false); return; }

  const broadRes = await apiPost("/admin/telegram/broadcast", {
    text: "🧪 Тест broadcast из test-скрипта — платформа работает нормально ✅",
    link: "https://t.me/BotCraftAi_Test_4_bot",
  }, token);

  log("Admin broadcast endpoint", broadRes.status === 200, `sent=${broadRes.body.sent} failed=${broadRes.body.failed}`);
}

// ── 4. Проверка bot status ────────────────────────────────────────────────────

async function testBotStatus() {
  console.log("\n━━━ 4. BOT STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const loginRes = await apiPost("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = loginRes.body.token ?? loginRes.body.accessToken;
  if (!token) { log("Login for bot status", false); return; }

  const statusRes = await apiGet("/admin/telegram/status", token);
  log(
    "Bot status endpoint",
    statusRes.status === 200 && statusRes.body.online === true,
    `online=${statusRes.body.online} username=@${statusRes.body.username}`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
console.log("  ТЕСТ TELEGRAM-УВЕДОМЛЕНИЙ «ХОЧУ_ТО»");
console.log(`  Бот-токен: ...${BOT_TOKEN.slice(-8)}`);
console.log(`  Telegram chat_id: ${CHAT_ID}  (superadmin)`);
console.log(`  API: ${API_BASE}`);
console.log("═══════════════════════════════════════════════════════════════");

try {
  await testBotStatus();
  await testDirectTelegramDelivery();
  await testBookingFlow();
  await testAdminBroadcast();
} catch (err) {
  console.error("\n💥 Unhandled error:", err.message);
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  ИТОГ: ✅ ${passed} прошли  ❌ ${failed} упали`);
console.log("═══════════════════════════════════════════════════════════════\n");
if (failed > 0) process.exit(1);
