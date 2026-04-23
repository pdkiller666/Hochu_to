import { Router } from "express";
import { db, regionsTable } from "@workspace/db";

const router = Router();

// Нормализация строки для сравнения
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Сопоставляет название города/региона от ip-api.com с регионом из БД
function matchSlug(
  cityName: string,
  regionName: string,
  regions: { name: string; slug: string }[]
): string | null {
  const tryMatch = (input: string): string | null => {
    const n = norm(input);
    if (!n) return null;

    // 1. Точное совпадение
    let m = regions.find(r => norm(r.name) === n);
    if (m) return m.slug;

    // 2. Регион начинается с input или наоборот
    m = regions.find(r => norm(r.name).startsWith(n) || n.startsWith(norm(r.name)));
    if (m) return m.slug;

    // 3. Слова длиннее 4 символов входят в название региона
    const words = n.split(" ").filter(w => w.length > 4);
    if (words.length > 0) {
      m = regions.find(r => {
        const rn = norm(r.name);
        return words.some(w => rn.includes(w));
      });
      if (m) return m.slug;
    }

    return null;
  };

  // Пробуем по городу, потом по названию региона от ip провайдера
  return tryMatch(cityName) ?? tryMatch(regionName);
}

router.get("/geoip", async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : null)
    ?? req.socket.remoteAddress
    ?? "";

  const cleanIp = ip.replace(/^::ffff:/, "");
  const isLocal = !cleanIp
    || cleanIp === "127.0.0.1"
    || cleanIp === "::1"
    || cleanIp.startsWith("10.")
    || cleanIp.startsWith("172.16.")
    || cleanIp.startsWith("192.168.");

  // Получаем список регионов из БД один раз
  let regions: { name: string; slug: string }[] = [];
  try {
    regions = await db.select({ name: regionsTable.name, slug: regionsTable.slug }).from(regionsTable);
  } catch {}

  if (isLocal) {
    // На локальной разработке/превью настоящий IP клиента недоступен.
    // НЕ возвращаем фолбэк-регион (это приводило к "вечной Москве" в кеше) —
    // пусть фронт оставит регион пустым и предложит выбрать вручную.
    res.json({ regionSlug: null, city: null, approximate: true, local: true });
    return;
  }

  // ── Провайдер 1: ipwho.is ─────────────────────────────────────────────────
  try {
    const resp = await fetch(`https://ipwho.is/${cleanIp}`);
    const data = await resp.json() as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
    };
    if (data.success && data.city) {
      const regionSlug = matchSlug(data.city, data.region ?? "", regions);
      res.json({
        regionSlug,
        city: data.city,
        lat: data.latitude,
        lng: data.longitude,
        approximate: true,
      });
      return;
    }
  } catch {}

  // ── Провайдер 2: ip-api.com (HTTP, бесплатный) ────────────────────────────
  try {
    const resp = await fetch(
      `http://ip-api.com/json/${cleanIp}?lang=ru&fields=status,lat,lon,city,regionName`
    );
    const data = await resp.json() as {
      status?: string;
      lat?: number;
      lon?: number;
      city?: string;
      regionName?: string;
    };
    if (data.status === "success" && data.city) {
      const regionSlug = matchSlug(data.city, data.regionName ?? "", regions);
      res.json({
        regionSlug,
        city: data.city,
        lat: data.lat,
        lng: data.lon,
        approximate: true,
      });
      return;
    }
  } catch {}

  res.status(502).json({ error: "geoip_unavailable" });
});

export default router;
