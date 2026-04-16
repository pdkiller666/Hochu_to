import { Router } from "express";

const router = Router();

router.get("/geoip", async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : null)
    ?? req.socket.remoteAddress
    ?? "";

  const cleanIp = ip.replace(/^::ffff:/, "");
  const isLocal = !cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp.startsWith("10.") || cleanIp.startsWith("192.168.");

  if (isLocal) {
    res.json({ lat: 55.7558, lng: 37.6173, city: "Москва", approximate: true });
    return;
  }

  try {
    const resp = await fetch(`https://ipwho.is/${cleanIp}`);
    const data = await resp.json() as { success?: boolean; latitude?: number; longitude?: number; city?: string };
    if (data.success && data.latitude && data.longitude) {
      res.json({ lat: data.latitude, lng: data.longitude, city: data.city ?? null, approximate: true });
      return;
    }
  } catch {}

  try {
    const resp = await fetch(`http://ip-api.com/json/${cleanIp}?lang=ru&fields=status,lat,lon,city`);
    const data = await resp.json() as { status?: string; lat?: number; lon?: number; city?: string };
    if (data.status === "success" && data.lat && data.lon) {
      res.json({ lat: data.lat, lng: data.lon, city: data.city ?? null, approximate: true });
      return;
    }
  } catch {}

  res.status(502).json({ error: "geoip_unavailable" });
});

export default router;
