import { useEffect, useRef } from "react";

type Shop = { id: string; name: string; area: string | null; lat: number | null; lng: number | null };
type G = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let loader: Promise<G> | null = null;
function loadMaps(): Promise<G> {
  const w = window as unknown as { google?: G; __initLLMap?: () => void };
  if (w.google?.maps?.Map) return Promise.resolve(w.google);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    w.__initLLMap = () => resolve(w.google);
    const env = import.meta.env as Record<string, string | undefined>;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"]}&loading=async&callback=__initLLMap&channel=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"]}&region=IN`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("Maps failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}

export const directionsUrl = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`;

export function ShopsMap({ shops, center, onSelect, className = "h-80" }: {
  shops: Shop[]; center: { lat: number; lng: number; name?: string }; onSelect?: (id: string) => void; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<G>(null);
  const markers = useRef<G[]>([]);

  useEffect(() => {
    let dead = false;
    loadMaps().then((google) => {
      if (dead || !el.current) return;
      if (!map.current) {
        map.current = new google.maps.Map(el.current, {
          center, zoom: 13, clickableIcons: false, mapTypeControl: false, streetViewControl: false,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
      }
      markers.current.forEach((m) => m.setMap(null));
      const info = new google.maps.InfoWindow();
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(center);
      const me = new google.maps.Marker({
        map: map.current, position: center, title: "You",
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      markers.current = [me];
      shops.filter((s) => s.lat != null && s.lng != null).forEach((s) => {
        const pos = { lat: s.lat!, lng: s.lng! };
        bounds.extend(pos);
        const m = new google.maps.Marker({ map: map.current, position: pos, title: s.name });
        m.addListener("click", () => {
          const div = document.createElement("div");
          div.style.cssText = "font:14px sans-serif;max-width:200px";
          const b = document.createElement("strong"); b.textContent = s.name; div.appendChild(b);
          const p = document.createElement("div"); p.textContent = s.area ?? ""; div.appendChild(p);
          const a = document.createElement("a"); a.href = directionsUrl(center, pos); a.target = "_blank"; a.rel = "noreferrer";
          a.textContent = "Get directions →"; a.style.cssText = "color:#c2410c;font-weight:600"; div.appendChild(a);
          info.setContent(div); info.open({ map: map.current, anchor: m });
          onSelect?.(s.id);
        });
        markers.current.push(m);
      });
      if (shops.length > 1) map.current.fitBounds(bounds, 40); else map.current.setCenter(center);
    }).catch(() => {});
    return () => { dead = true; };
  }, [shops, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`w-full overflow-hidden rounded-2xl border bg-muted ${className}`} />;
}
