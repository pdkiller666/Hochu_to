import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  height?: number;
}

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
  <path fill="#C65D3B" stroke="#fff" stroke-width="1.5" d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"/>
  <circle fill="#fff" cx="12" cy="12" r="5"/>
</svg>`;

const pinIcon = L.divIcon({
  className: "",
  html: PIN_SVG,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
});

/**
 * Stage 22b — компактная карта точки съёмки Цифрового Акта.
 *
 * Используется в админке (DigitalActsBlock). Read-only, один пин,
 * scrollWheelZoom выключен — карта внутри длинной модалки арбитража.
 * Тайлы — публичный OSM (тот же источник, что у ListingMap).
 */
export function DigitalActMap({ lat, lng, height = 180 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (instanceRef.current) {
      instanceRef.current.remove();
      instanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      dragging: true,
    });
    instanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    map.setView([lat, lng], 16);
    L.marker([lat, lng], { icon: pinIcon }).addTo(map);

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [lat, lng]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-stone-200 z-0"
    />
  );
}
