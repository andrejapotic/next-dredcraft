"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import CandleOverlay from "@/components/CandleOverlay";
import TokenText from "@/components/TokenText";
import { AudioEngine } from "@/lib/audio";
import type { Story } from "@/data/sampleStory";

export default function ReaderLivePage() {
  const [story, setStory] = useState<Story | null>(null);
  const [started, setStarted] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);

  // scroll + pointer state
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pointerYRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("currentStory");
      if (raw) setStory(JSON.parse(raw));
    } catch {}
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) { pointerYRef.current = e.clientY; }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  let raf: number | null = null;

  const tick = () => {
    const rect = el.getBoundingClientRect();
    const y = pointerYRef.current;
    const within = y >= rect.top && y <= rect.bottom;
    let dy = 0;

    if (within) {
      const rel = (y - rect.top) / rect.height; // 0..1
      if (rel > 0.8) dy = (rel - 0.8) * 8;
      else if (rel < 0.2) dy = (rel - 0.2) * 8;
      if (dy !== 0) el.scrollTop += dy;
    }

    raf = requestAnimationFrame(tick);
  };

  const startLoop = () => { if (raf == null) raf = requestAnimationFrame(tick); };
  const stopLoop  = () => { if (raf != null) { cancelAnimationFrame(raf); raf = null; } };

  el.addEventListener("pointerenter", startLoop);
  el.addEventListener("pointerleave", stopLoop);

  return () => {
    stopLoop();
    el.removeEventListener("pointerenter", startLoop);
    el.removeEventListener("pointerleave", stopLoop);
  };
}, []);

  function findAmbienceForIndex(idx: number) {
    if (!story) return null;
    const amb = (story.annotations ?? [])
      .filter(a => a.layer === "ambience")
      .filter(a => idx >= a.start && idx < a.end)
      .sort((a, b) => b.start - a.start)[0];
    return amb ?? null;
  }

  async function start() {
    if (!story) return;
    if (!engineRef.current) engineRef.current = new AudioEngine();
    const engine = engineRef.current;

    await engine.init();
    await engine.ensureResumed();

    await Promise.all((story.assets ?? []).map(a => engine.load(a.id, a.url)));

    const initialAmb = findAmbienceForIndex(0);
    if (initialAmb) {
      engine.crossfadeAmbienceTo(initialAmb.assetId, {
        volume: initialAmb.volume ?? 0.35,
        fadeMs: initialAmb.fadeInMs ?? 300,
      });
    } else {
      engine.crossfadeAmbienceTo(null);
    }

    setStarted(true);
  }

  function handleTriggerSfx(assetId: string) {
    engineRef.current?.playSfx(assetId, 1);
  }

  function handleCursorChar(idx: number) {
    const amb = findAmbienceForIndex(idx);
    if (!engineRef.current) return;
    if (amb) {
      engineRef.current.crossfadeAmbienceTo(amb.assetId, { volume: amb.volume ?? 0.35, fadeMs: 250 });
    } else {
      engineRef.current.crossfadeAmbienceTo(null, { fadeMs: 250 });
    }
  }

  if (!story) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">No story loaded</h1>
          <p className="text-white/60">Go to /author and click “Preview in Reader”.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {!started ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-3xl font-semibold">{story.title ?? "Untitled"}</h1>
          <button
            onClick={start}
            className="rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20 transition"
          >
            Start Reading
          </button>
        </div>
      ) : (
        <div className="relative">
          <CandleOverlay radius={140} />
          <section className="mx-auto max-w-3xl px-6 py-8">
            <div ref={scrollRef} className="max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
              <h2 className="mb-6 text-2xl font-medium">{story.title ?? "Untitled"}</h2>
              <TokenText
                story={story}
                onTriggerSfx={handleTriggerSfx}
                onCursorAtChar={handleCursorChar}
              />
              <div className="h-40" />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
