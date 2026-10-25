import { useEffect, useRef, useState } from "react";
import { MapPin, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportConnectionFailure } from "@/lib/connectivity";

export type StorePin = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude: number;
  longitude: number;
};

type GoogleMapInstance = {
  setCenter: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (eventName: string, handler: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: { map: GoogleMapInstance; position: { lat: number; lng: number }; title: string }) => GoogleMarker;
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
    initStockSpotMap?: () => void;
  }
}

const MAP_READY_EVENT = "stockspot-maps-ready";
const DEFAULT_CENTER = { lat: 20, lng: 0 };

function loadMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-stockspot-maps="true"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      window.addEventListener(MAP_READY_EVENT, () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps could not load.")), { once: true });
    });
  }

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const trackingId = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
  if (!key) return Promise.reject(new Error("Google Maps needs an available map key."));

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ key, loading: "async", callback: "initStockSpotMap" });
    if (trackingId) params.set("channel", trackingId);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.dataset.stockspotMaps = "true";
    window.initStockSpotMap = () => {
      window.dispatchEvent(new Event(MAP_READY_EVENT));
      resolve();
    };
    script.onerror = () => reject(new Error("Google Maps could not load."));
    document.head.append(script);
  });
}

export function StoreMap({
  stores,
  selectable = false,
  selectedLocation,
  onLocationSelect,
}: {
  stores: StorePin[];
  selectable?: boolean;
  selectedLocation?: { lat: number; lng: number } | null;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const onLocationSelectRef = useRef(onLocationSelect);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !elementRef.current || !window.google) return;
        mapRef.current = new window.google.maps.Map(elementRef.current, {
          center: selectedLocation ?? stores[0] ?? DEFAULT_CENTER,
          zoom: stores.length > 1 ? 11 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        if (selectable) {
          mapRef.current.addListener("click", (event) => {
            const lat = event.latLng?.lat();
            const lng = event.latLng?.lng();
            if (typeof lat === "number" && typeof lng === "number") {
              onLocationSelectRef.current?.({ lat, lng });
            }
          });
        }
        setStatus("ready");
      })
      .catch((error: unknown) => {
        reportConnectionFailure(error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapsApi = window.google?.maps;
    if (!map || !mapsApi) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = stores.map(
      (store) =>
        new mapsApi.Marker({
          map,
          position: { lat: store.latitude, lng: store.longitude },
          title: [store.name, store.address, store.city].filter(Boolean).join(" · "),
        }),
    );
    const center = selectedLocation ?? stores[0];
    if (center) map.setCenter(center);
    if (stores.length === 1) map.setZoom(14);

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [stores, selectedLocation, status]);

  if (status === "error") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 border border-border bg-muted/40 px-6 text-center">
        <MapPin className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">Map is temporarily unavailable</p>
        <p className="text-xs text-muted-foreground">Store addresses remain available below.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border border-border">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-sm text-muted-foreground">
          <MapIcon className="mr-2 size-4" /> Loading map…
        </div>
      )}
      <div ref={elementRef} className="h-72 w-full sm:h-96" aria-label="Map of grocery stores" />
      {selectable && <p className="sr-only">Select a point on the map to place your store pin.</p>}
    </div>
  );
}

export function MapViewToggle({ map, onChange }: { map: boolean; onChange: (map: boolean) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="sm" variant={map ? "outline" : "secondary"} onClick={() => onChange(false)}>
        List
      </Button>
      <Button type="button" size="sm" variant={map ? "secondary" : "outline"} onClick={() => onChange(true)}>
        <MapIcon className="size-4" /> Map
      </Button>
    </div>
  );
}