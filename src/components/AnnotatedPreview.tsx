"use client";
import { useMemo } from "react";
import type { Annotation } from "@/data/sampleStory";

export default function AnnotatedPreview({
  body,
  annotations,
}: {
  body: string;
  annotations: Annotation[];
}) {
  // We'll reuse the simple tokenizer idea: group \w+ as words, else single char
  const parts = useMemo(() => {
    const arr: { text: string; start: number; end: number; hasSfx?: boolean; hasAmb?: boolean }[] = [];
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
    for (const p of arr) {
      p.hasSfx = annotations.some(a => a.layer === "sfx" && p.start < a.end && a.start < p.end);
      p.hasAmb = annotations.some(a => a.layer === "ambience" && p.start < a.end && a.start < p.end);
    }
    return arr;
  }, [body, annotations]);

  return (
    <div className="prose prose-invert max-w-none leading-8 text-lg whitespace-pre-wrap">
      {parts.map((p, idx) => {
        const isSpace = /^\s$/.test(p.text);
        const className = [
          p.hasSfx ? "underline decoration-dotted decoration-2 underline-offset-4" : "",
          p.hasAmb ? "bg-yellow-500/15 rounded-sm" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (isSpace) return <span key={idx}>{p.text}</span>;
        return (
          <span key={idx} className={className}>
            {p.text}
          </span>
        );
      })}
    </div>
  );
}
