import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ListingMapProps {
  city?: string | null;
  regionName?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45">
  <path fill="#C65D3B" stroke="#fff" stroke-width="1.5" d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"/>
  <circle fill="#fff" cx="12" cy="12" r="5"/>
</svg>`;

const pinIcon = L.divIcon({
  className: "",
  html: PIN_SVG,
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

export function ListingMap({ city, regionName, lat, lng }: ListingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const hasPrecise = !!(lat && lng);
  const hasLocation = hasPrecise || !!(city || regionName);
  const query = [city, regionName, "Россия"].filter(Boolean).join(", ");

  useEffect(() => {
    if (!mapRef.current || !hasLocation) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      dragging: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);


    if (hasPrecise) {
      map.setView([lat!, lng!], 16);
      L.marker([lat!, lng!], { icon: pinIcon }).addTo(map);
    } else {
      map.setView([55.75, 37.62], 10);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=ru`,
        { headers: { "User-Agent": "HochuTo/1.0" } }
      )
        .then(r => r.json())
        .then((data: Array<{ lat: string; lon: string }>) => {
          if (!data[0] || !mapInstanceRef.current) return;
          const lt = parseFloat(data[0].lat);
          const ln = parseFloat(data[0].lon);
          const zoom = city ? 13 : 11;
          const radius = city ? 700 : 3000;
          mapInstanceRef.current.setView([lt, ln], zoom);
          L.circle([lt, ln], {
            radius,
            color: "#C65D3B",
            fillColor: "#C65D3B",
            fillOpacity: 0.18,
            weight: 2,
          }).addTo(mapInstanceRef.current);
        })
        .catch(() => {});
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasPrecise, lat, lng, query, hasLocation]);

  if (!hasLocation) return null;

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        className="h-56 w-full rounded-2xl overflow-hidden border border-border shadow-sm z-0"
      />
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <span>📍</span>
        {hasPrecise
          ? "Точное местонахождение — передача вещи по договорённости с владельцем"
          : "Приблизительное местонахождение — точный адрес уточняйте у владельца"}
      </p>
    </div>
  );
}
