"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "@/data/sampleStory";

type Props = {
  body: string;
  annotations: Annotation[];
  activeId?: string | null;
  onChangeActive?: (id: string | null) => void;
  onUpdateAnnotation: (updated: Annotation) => void;
};

export default function RangePreviewEditor({
  body,
  annotations,
  activeId,
  onChangeActive,
  onUpdateAnnotation,
}: Props) {
  // Precompute per-char overlap flags to style preview (lightweight)
  const charMeta = useMemo(() => {
    const meta = Array.from({ length: body.length }, () => ({
      hasSfx: 0,
      hasAmb: 0,
      isStart: false,
      isEnd: false,
    }));
    for (const a of annotations) {
      for (let i = Math.max(0, a.start); i < Math.min(body.length, a.end); i++) {
        if (a.layer === "sfx") meta[i].hasSfx++;
        if (a.layer === "ambience") meta[i].hasAmb++;
      }
      if (a.start >= 0 && a.start < body.length) meta[a.start].isStart = true;
      if (a.end > 0 && a.end - 1 < body.length) meta[a.end - 1].isEnd = true;
    }
    return meta;
  }, [body, annotations]);

  // Drag state for handles
  const [dragging, setDragging] = useState<null | { side: "start" | "end"; id: string }>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map pointer to character index: rely on per-char spans with data-idx
  function getIndexFromPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return null;
    const idxAttr = el.dataset?.idx;
    if (!idxAttr) return null;
    const idx = parseInt(idxAttr, 10);
    if (Number.isNaN(idx)) return null;
    return Math.max(0, Math.min(body.length, idx));
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const idx = getIndexFromPoint(e.clientX, e.clientY);
      if (idx == null) return;

      const a = annotations.find(x => x.id === dragging.id);
      if (!a) return;

      let { start, end } = a;
      if (dragging.side === "start") {
        start = Math.min(idx, end - 1);
      } else {
        end = Math.max(idx + 1, start + 1);
      }
      if (start !== a.start || end !== a.end) {
        onUpdateAnnotation({ ...a, start, end });
      }
    }
    function onUp() {
      setDragging(null);
    }
    if (dragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp, { once: true });
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, annotations, onUpdateAnnotation, body.length]);

  const active = annotations.find(a => a.id === activeId) || null;

  return (
    <div
      ref={containerRef}
      className="relative rounded-md bg-white/5 p-4 min-h-64 whitespace-pre-wrap leading-8 text-lg prose prose-invert max-w-none select-none"
      onMouseDown={(e) => {
        // activate by clicking on any annotated char
        const idx = getIndexFromPoint(e.clientX, e.clientY);
        if (idx == null) return;
        const hit = annotations.find(a => idx >= a.start && idx < a.end);
        if (onChangeActive) onChangeActive(hit?.id ?? null);
      }}
    >
      {/* Render per-char spans so we can map pointer -> index */}
      {Array.from(body).map((ch, idx) => {
        const m = charMeta[idx];
        const inActive = !!active && idx >= active.start && idx < active.end;

        const classes: string[] = [];
        if (m.hasSfx > 0) classes.push("underline", "decoration-dotted", "decoration-2", "underline-offset-4");
        if (m.hasAmb > 0) classes.push("bg-yellow-500/15", "rounded-sm");
        if (m.hasAmb > 1) classes.push("outline", "outline-1", "outline-red-500/60"); // show overlap

        return (
          <span
            key={idx}
            data-idx={idx}
            className={classes.join(" ")}
            style={{ cursor: inActive ? "text" : "default" }}
          >
            {ch}
            {/* Left handle at the start index of the active annotation */}
            {active && idx === active.start ? (
              <span
                data-idx={idx}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging({ side: "start", id: active.id });
                }}
                title="Drag start"
                className="inline-block align-middle w-2 h-4 bg-blue-400/80 rounded-sm ml-[-4px] mr-[2px] cursor-ew-resize"
              />
            ) : null}
            {/* Right handle placed just before end index (visually after the char) */}
            {active && idx === active.end - 1 ? (
              <span
                data-idx={idx}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging({ side: "end", id: active.id });
                }}
                title="Drag end"
                className="inline-block align-middle w-2 h-4 bg-blue-400/80 rounded-sm ml-[2px] mr-[-4px] cursor-ew-resize"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
