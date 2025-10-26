"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import CandleOverlay from "@/components/CandleOverlay";
import TokenText from "@/components/TokenText";
import { sampleStory } from "@/data/sampleStory";
import { AudioEngine } from "@/lib/audio";

export default function ReaderPage() {
  const [started, setStarted] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);
  const story = useMemo(() => sampleStory, []);

  // --- Auto-scroll state
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pointerYRef = useRef<number>(0);
  const scrollingRef = useRef<number | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointerYRef.current = e.clientY;
    }
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

  // --- Ambience switching based on char index
  function findAmbienceForIndex(idx: number) {
    const amb = story.annotations
      .filter(a => a.layer === "ambience")
      .filter(a => idx >= a.start && idx < a.end)
      // prefer the region with the latest start (more specific)
      .sort((a, b) => b.start - a.start)[0];
    return amb ?? null;
  }

  async function start() {
    if (!engineRef.current) engineRef.current = new AudioEngine();
    const engine = engineRef.current;

    await engine.init();
    await engine.ensureResumed();

    // Preload all assets in story
    await Promise.all((story.assets ?? []).map(a => engine.load(a.id, a.url)));

    // Start with ambience for index 0 (if any)
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
    const engine = engineRef.current;
    if (!engine) return;

    const amb = findAmbienceForIndex(idx);
    if (amb) {
      engine.crossfadeAmbienceTo(amb.assetId, {
        volume: amb.volume ?? 0.35,
        fadeMs: 250,
      });
    } else {
      // Outside any ambience → fade to silence
      engine.crossfadeAmbienceTo(null, { fadeMs: 250 });
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {!started ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-3xl font-semibold">Interactive Reader (Ambience v2)</h1>
          <button
            onClick={start}
            className="rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20 transition"
          >
            Start Reading
          </button>
          <p className="text-sm text-white/60">
            Audio will start after you click. Move the cursor to reveal text. Ambience changes by context.
          </p>
        </div>
      ) : (
        <div className="relative">
          <CandleOverlay radius={140} />
          <section className="mx-auto max-w-3xl px-6 py-8">
            {/* Scrollable region */}
            <div
              ref={scrollRef}
              className="max-h-[calc(100vh-160px)] overflow-y-auto pr-2"
            >
              <h2 className="mb-6 text-2xl font-medium">{story.title}</h2>
              <TokenText
                story={story}
                onTriggerSfx={handleTriggerSfx}
                onCursorAtChar={handleCursorChar}
              />
              <div className="h-40" /> {/* bottom padding to make reaching end easier */}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
