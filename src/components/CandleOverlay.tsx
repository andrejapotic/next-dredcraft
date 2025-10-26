"use client";
import { useEffect, useRef } from "react";

export default function CandleOverlay({ radius = 140 }: { radius?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (e: PointerEvent) => {
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
      el.style.setProperty("--r", `${radius}px`);
    };

    // Initialize roughly center
    el.style.setProperty("--mx", `50vw`);
    el.style.setProperty("--my", `50vh`);
    el.style.setProperty("--r", `${radius}px`);

    window.addEventListener("pointermove", update, { passive: true });
    return () => window.removeEventListener("pointermove", update);
  }, [radius]);

  return <div ref={ref} className="candle-overlay z-50" />;
}
