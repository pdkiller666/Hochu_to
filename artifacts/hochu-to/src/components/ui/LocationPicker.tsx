import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2 } from "lucide-react";

interface LocationPickerProps {
  lat?: number | null;
  lng?: number | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
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
  popupAnchor: [0, -45],
});

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const placeMarker = useCallback((map: L.Map, latlng: L.LatLng) => {
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: pos.lat, lng: pos.lng });
      });
    }
    onChangeRef.current({ lat: latlng.lat, lng: latlng.lng });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    const defaultCenter: [number, number] = [55.75, 37.62];
    const defaultZoom = lat && lng ? 15 : 10;
    const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter;

    const map = L.map(mapRef.current, {
      center,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);


    if (lat && lng) {
      const latlng = L.latLng(lat, lng);
      markerRef.current = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: pos.lat, lng: pos.lng });
      });
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(map, e.latlng);
      setGeoError(null);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const placeByCoords = (lat: number, lng: number, zoom: number) => {
    const latlng = L.latLng(lat, lng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(latlng, zoom, { animate: true });
      placeMarker(mapInstanceRef.current, latlng);
    }
  };

  const fallbackToIp = () => {
    const API_BASE = import.meta.env.VITE_API_URL ?? "";
    fetch(`${API_BASE}/api/geoip`)
      .then(r => r.json())
      .then((data: { lat?: number; lng?: number }) => {
        if (data.lat && data.lng) {
          placeByCoords(data.lat, data.lng, 12);
          setGeoError("Определено по IP — уточните метку вручную");
        } else {
          setGeoError("Не удалось определить местоположение — поставьте метку вручную");
        }
      })
      .catch(() => {
        setGeoError("Не удалось определить местоположение — поставьте метку вручную");
      })
      .finally(() => setLocating(false));
  };

  const handleAutoLocate = () => {
    setLocating(true);
    setGeoError(null);

    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeByCoords(pos.coords.latitude, pos.coords.longitude, 16);
        setLocating(false);
      },
      () => {
        fallbackToIp();
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  const handleClear = () => {
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChangeRef.current(null);
    setGeoError(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handleAutoLocate}
          disabled={locating}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <LocateFixed className="w-4 h-4" />}
          {locating ? "Определяем..." : "Моё местоположение"}
        </button>
        {lat && lng && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
          >
            Убрать метку
          </button>
        )}
      </div>

      <div
        ref={mapRef}
        className="h-64 w-full rounded-2xl overflow-hidden border border-border shadow-sm z-0"
      />

      <div className="min-h-[18px]">
        {geoError ? (
          <p className="text-xs text-amber-600">{geoError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {lat && lng
              ? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} — маркер можно перетащить для уточнения`
              : "Нажмите «Моё местоположение» или кликните на карту"}
          </p>
        )}
      </div>
    </div>
  );
}
