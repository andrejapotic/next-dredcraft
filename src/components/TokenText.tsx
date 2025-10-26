"use client";
import { useMemo, useRef } from "react";
import type { Annotation, Story } from "@/data/sampleStory";

type Props = {
  story: Story;
  onTriggerSfx: (assetId: string) => void;
  onCursorAtChar?: (charIndex: number) => void; // NEW
};

export default function TokenText({ story, onTriggerSfx, onCursorAtChar }: Props) {
  const sfxRanges = useMemo(
    () => story.annotations.filter(a => a.layer === "sfx"),
    [story.annotations]
  );

  // Build tokens preserving exact char offsets
  const parts = useMemo(() => {
    const arr: { text: string; start: number; end: number; triggerAsset?: string; sentenceIndex?: number }[] = [];
    const { body } = story;
    let i = 0;
    while (i < body.length) {
      const ch = body[i];
      if (/\w/.test(ch)) {
        let j = i + 1;
        while (j < body.length && /\w/.test(body[j])) j++;
        arr.push({ text: body.slice(i, j), start: i, end: j });
        i = j;
      } else {
        arr.push({ text: ch, start: i, end: i + 1 });
        i++;
      }
    }
    // Mark SFX overlaps
    for (const p of arr) {
      const hit = sfxRanges.find(r => p.start < r.end && r.start < p.end);
      if (hit) p.triggerAsset = hit.assetId;
    }
    return arr;
  }, [story, sfxRanges]);

  // Sentence ranges (very simple split on . ! ?)
  const sentenceRanges = useMemo(() => {
  const ranges: Array<{ start: number; end: number }> = [];
  const text = story.body;
  const re = /[^.!?]+[.!?]?/g; // ensures progress; no zero-length loops
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = re.lastIndex;
    if (end > start) ranges.push({ start, end });
    else {
      // ultra-defensive: in case of any engine quirk, force progress
      re.lastIndex++;
    }
  }

  if (ranges.length === 0 && text.length > 0) {
    ranges.push({ start: 0, end: text.length });
  }
  return ranges;
}, [story.body]);

  // Map each token to a sentence index
  const tokenSentenceIndex = useMemo(() => {
  return parts.map(p => {
    const idx = sentenceRanges.findIndex(r => p.start >= r.start && p.start < r.end);
    return idx === -1 ? sentenceRanges.length - 1 : idx;
  });
}, [parts, sentenceRanges]);

  // Forward-only lock: never trigger SFX for earlier sentences
  const currentSentenceRef = useRef(0);
  const cooldownMap = useRef<Map<string, number>>(new Map());
  const TRIGGER_DWELL_MS = 80;

  function handleEnter(e: React.MouseEvent<HTMLSpanElement>, partIdx: number) {
    const el = e.currentTarget as HTMLSpanElement;
    const asset = el.dataset.assetId || undefined;
    const tokenKey = el.dataset.key!;
    const part = parts[partIdx];

    // report char index for ambience switching
    onCursorAtChar?.(part.start);

    // sentence guard (no triggers for *earlier* sentences)
    const sIdx = tokenSentenceIndex[partIdx] ?? 0;
    if (sIdx < currentSentenceRef.current) {
      return;
    }
    // Move forward if needed
    if (sIdx > currentSentenceRef.current) {
      currentSentenceRef.current = sIdx;
    }

    if (!asset) return;
    const now = performance.now();
    const last = cooldownMap.current.get(tokenKey) || 0;
    const cd = (story.annotations.find(a => a.assetId === asset)?.cooldownMs ?? 600);
    if (now - last < cd) return;

    const t = setTimeout(() => {
      onTriggerSfx(asset);
      cooldownMap.current.set(tokenKey, performance.now());
    }, TRIGGER_DWELL_MS);

    (el as any).__dw = t;
  }

  function handleLeave(e: React.MouseEvent<HTMLSpanElement>) {
    const t = (e.currentTarget as any).__dw as any;
    if (t) clearTimeout(t);
  }

  return (
    <div className="prose prose-invert max-w-none leading-8 text-lg whitespace-pre-wrap">
      {parts.map((p, i) => {
        const key = `t-${i}`;
        const isSpace = /^\s$/.test(p.text);
        if (isSpace) return <span key={key}>{p.text}</span>;

        const className = p.triggerAsset
          ? "underline decoration-dotted decoration-2 underline-offset-4"
          : undefined;

        return (
          <span
            key={key}
            data-key={key}
            data-asset-id={p.triggerAsset}
            onMouseEnter={(e) => handleEnter(e, i)}
            onMouseLeave={handleLeave}
            className={className}
          >
            {p.text}
          </span>
        );
      })}
    </div>
  );
}
