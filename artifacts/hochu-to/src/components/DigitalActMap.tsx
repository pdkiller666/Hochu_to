import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Pin {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  /** Single-pin legacy mode */
  lat?: number;
  lng?: number;
  /** Multi-pin mode — overrides lat/lng */
  pins?: Pin[];
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
  popupAnchor: [0, -38],
});

/**
 * Stage 22b — компактная карта точки съёмки Цифрового Акта.
 *
 * Stage 33.1 — поддержка нескольких пинов (pins[]).
 * При наличии нескольких маркеров карта автоматически подгоняет
 * bounds, чтобы все пины были видны. Клик по маркеру открывает
 * popup с координатами (и label, если передан).
 *
 * Используется в админке (DigitalActsBlock). Read-only,
 * scrollWheelZoom выключен — карта внутри длинной модалки.
 * Тайлы — публичный OSM.
 */
export function DigitalActMap({ lat, lng, pins, height = 180 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);

  // Нормализуем список пинов из обоих форматов пропсов
  const normalizedPins: Pin[] = pins && pins.length > 0
    ? pins
    : (lat != null && lng != null ? [{ lat, lng }] : []);

  const pinKey = normalizedPins.map(p => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!mapRef.current || normalizedPins.length === 0) return;

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

    const markers: L.Marker[] = [];
    for (const pin of normalizedPins) {
      const m = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(map);
      const popupText = pin.label
        ? `<b>${pin.label}</b><br/>${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
        : `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
      m.bindPopup(popupText);
      markers.push(m);
    }

    if (normalizedPins.length === 1) {
      map.setView([normalizedPins[0].lat, normalizedPins[0].lng], 16);
    } else {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.25));
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, height]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-stone-200 z-0"
    />
  );
}
