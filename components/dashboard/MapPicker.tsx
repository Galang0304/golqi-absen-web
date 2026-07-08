'use client';

import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
}

const DEFAULT_CENTER = { lat: -5.4667, lng: 120.2 }; // Bulukumba
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function MapPicker({ latitude, longitude, radius, onLocationChange, onRadiusChange }: MapPickerProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onChangeRef = useRef(onLocationChange);
  const onRadiusChangeRef = useRef(onRadiusChange);
  const [error, setError] = useState('');

  onChangeRef.current = onLocationChange;
  onRadiusChangeRef.current = onRadiusChange;

  // Init map once
  useEffect(() => {
    if (!API_KEY) {
      setError('Google Maps API key belum diatur (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).');
      return;
    }
    let cancelled = false;
    setOptions({ key: API_KEY, v: 'weekly' });

    Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('places')])
      .then(([{ Map, Circle }, { Marker }, { Autocomplete }]) => {
        if (cancelled || !mapEl.current) return;

        const center =
          latitude != null && longitude != null ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;

        const map = new Map(mapEl.current, {
          center,
          zoom: latitude != null ? 17 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const hasPos = latitude != null && longitude != null;
        const marker = new Marker({
          position: center,
          map,
          draggable: true,
          visible: hasPos,
        });
        markerRef.current = marker;

        const circle = new Circle({
          map,
          center,
          radius: radius || 100,
          fillColor: '#e11d48',
          fillOpacity: 0.12,
          strokeColor: '#e11d48',
          strokeOpacity: 0.7,
          strokeWeight: 2,
          visible: hasPos,
          editable: true,
          draggable: true,
        });
        circleRef.current = circle;

        const setPos = (lat: number, lng: number, zoom?: number) => {
          const p = { lat, lng };
          marker.setPosition(p);
          marker.setVisible(true);
          circle.setCenter(p);
          circle.setVisible(true);
          map.setCenter(p);
          if (zoom) map.setZoom(zoom);
          onChangeRef.current(lat, lng);
        };

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) setPos(e.latLng.lat(), e.latLng.lng());
        });
        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) setPos(e.latLng.lat(), e.latLng.lng());
        });

        // Circle resized on the map -> update radius
        circle.addListener('radius_changed', () => {
          const r = Math.round(circle.getRadius());
          onRadiusChangeRef.current?.(r);
        });
        // Circle dragged on the map -> move marker + update location
        circle.addListener('center_changed', () => {
          const c = circle.getCenter();
          if (!c) return;
          marker.setPosition(c);
          marker.setVisible(true);
          onChangeRef.current(c.lat(), c.lng());
        });

        // Places search box
        if (searchEl.current) {
          const autocomplete = new Autocomplete(searchEl.current, {
            fields: ['geometry', 'name', 'formatted_address'],
          });
          autocomplete.bindTo('bounds', map);
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (loc) setPos(loc.lat(), loc.lng(), 17);
          });
        }
      })
      .catch((err: unknown) => {
        console.error('Google Maps load error:', err);
        setError('Gagal memuat Google Maps. Pastikan API key valid, Maps JavaScript API & Places API aktif.');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update circle radius when prop changes (guard against feedback loop)
  useEffect(() => {
    const c = circleRef.current;
    if (c && Math.round(c.getRadius()) !== Math.round(radius || 100)) {
      c.setRadius(radius || 100);
    }
  }, [radius]);

  // Sync marker/center when lat/lng props change externally (e.g. edit)
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const pos = { lat: latitude, lng: longitude };
    if (mapRef.current) mapRef.current.setCenter(pos);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
      markerRef.current.setVisible(true);
    }
    if (circleRef.current) {
      circleRef.current.setCenter(pos);
      circleRef.current.setVisible(true);
    }
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="w-full h-56 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center p-4 text-center">
        <p className="text-xs text-rose-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          ref={searchEl}
          type="text"
          placeholder="Cari lokasi / alamat..."
          className="w-full pl-9 pr-4 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
        />
      </div>
      <div ref={mapEl} className="w-full h-56 rounded-xl border border-slate-200 overflow-hidden" />
      <p className="text-[10px] text-slate-400">Cari lokasi, klik peta, atau geser pin. Lingkaran merah = zona absen — tarik titik tepinya untuk mengubah radius, atau seret untuk memindahkan.</p>
    </div>
  );
}
