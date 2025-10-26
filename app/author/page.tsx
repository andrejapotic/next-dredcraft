"use client";
import { useMemo, useRef, useState } from "react";
import RangePreviewEditor from "@/components/RangePreviewEditor";
import { sampleStory, type Annotation, type Asset, type Story } from "@/data/sampleStory";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAnchor(body: string, start: number, end: number, ctx = 16) {
  return {
    text: body.slice(start, end),
    prefix: body.slice(Math.max(0, start - ctx), start),
    suffix: body.slice(end, Math.min(body.length, end + ctx)),
  };
}

export default function AuthorPage() {
  const [title, setTitle] = useState(sampleStory.title);
  const [body, setBody] = useState(sampleStory.body);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([
    { id: "ambient-1", url: "/audio/ambient.mp3", kind: "ambience" },
    { id: "knock-1", url: "/audio/knock.mp3", kind: "sfx" },
  ]);

  const [selectedSfx, setSelectedSfx] = useState("knock-1");
  const [selectedAmb, setSelectedAmb] = useState("ambient-1");
  const [activeId, setActiveId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getSelection(): { start: number; end: number } | null {
    const el = textareaRef.current;
    if (!el) return null;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) return null;
    return start < end ? { start, end } : { start: end, end: start };
  }

  function addSfx() {
    setError(null);
    const sel = getSelection();
    if (!sel) return setError("Select a non-empty text range first.");
    const a: Annotation = {
      id: makeId("sfx"),
      start: sel.start,
      end: sel.end,
      layer: "sfx",
      assetId: selectedSfx,
      trigger: "hover",
      cooldownMs: 800,
      repeatable: false,
      anchor: buildAnchor(body, sel.start, sel.end),
    };
    setAnnotations(prev => [...prev, a]);
    setActiveId(a.id);
  }

  function addAmbience() {
    setError(null);
    const sel = getSelection();
    if (!sel) return setError("Select a non-empty text range first.");
    const a: Annotation = {
      id: makeId("amb"),
      start: sel.start,
      end: sel.end,
      layer: "ambience",
      assetId: selectedAmb,
      volume: 0.35,
      loop: true,
      fadeInMs: 300,
      fadeOutMs: 300,
      anchor: buildAnchor(body, sel.start, sel.end),
    };
    setAnnotations(prev => [...prev, a]);
    setActiveId(a.id);
  }

  function removeAnnotation(id: string) {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function updateAnnotation(updated: Annotation) {
    setAnnotations(prev => prev.map(a => (a.id === updated.id ? updated : a)));
  }

  // Basic overlap check for ambience
  const ambienceOverlaps = useMemo(() => {
    const amb = annotations.filter(a => a.layer === "ambience");
    const clashes: Array<[string, string]> = [];
    for (let i = 0; i < amb.length; i++) {
      for (let j = i + 1; j < amb.length; j++) {
        const a = amb[i], b = amb[j];
        if (a.start < b.end && b.start < a.end) clashes.push([a.id, b.id]);
      }
    }
    return clashes;
  }, [annotations]);

  // Realign using anchor.text (simple v1: first occurrence; if none, leave as-is)
  function realignAll() {
    setAnnotations(prev =>
      prev.map(a => {
        if (!a.anchor?.text) return a;
        const idx = body.indexOf(a.anchor.text);
        if (idx === -1) return a; // not found
        const newStart = idx;
        const newEnd = idx + a.anchor.text.length;
        if (newStart === a.start && newEnd === a.end) return a;
        return { ...a, start: newStart, end: newEnd };
      })
    );
  }

  const exported: Story = useMemo(
    () => ({ id: "draft", title, body, annotations, assets }),
    [title, body, annotations, assets]
  );

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(exported, null, 2)).catch(() => {});
  }

  function loadIntoReader() {
    try {
      localStorage.setItem("currentStory", JSON.stringify(exported));
      window.open("/reader/live", "_blank");
    } catch {
      setError("Could not save to localStorage.");
    }
  }

  const [assetForm, setAssetForm] = useState({ id: "", url: "", kind: "sfx" as Asset["kind"] });
  function addAsset() {
    if (!assetForm.id || !assetForm.url) {
      setError("Asset id and url are required.");
      return;
    }
    setAssets(prev => [...prev, { ...assetForm }]);
    setAssetForm({ id: "", url: "", kind: "sfx" });
  }

  const sfxOptions = assets.filter(a => a.kind === "sfx");
  const ambOptions = assets.filter(a => a.kind === "ambience");

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Authoring (MVP + drag-to-resize)</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: editor */}
          <div className="space-y-4">
            <input
              className="w-full rounded-md bg-white/5 px-3 py-2"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Story title"
            />
            <textarea
              ref={textareaRef}
              className="w-full h-64 rounded-md bg-white/5 px-3 py-2 font-mono"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your story here..."
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">SFX asset</label>
              <select
                className="bg-white/5 rounded px-2 py-1"
                value={selectedSfx}
                onChange={e => setSelectedSfx(e.target.value)}
              >
                {sfxOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.id}</option>
                ))}
              </select>
              <button onClick={addSfx} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                Add SFX to selection
              </button>

              <div className="w-px h-6 bg-white/10 mx-2" />

              <label className="text-sm">Ambience asset</label>
              <select
                className="bg-white/5 rounded px-2 py-1"
                value={selectedAmb}
                onChange={e => setSelectedAmb(e.target.value)}
              >
                {ambOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.id}</option>
                ))}
              </select>
              <button onClick={addAmbience} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                Add Ambience to selection
              </button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div>
              <h2 className="font-medium mb-2">Annotations</h2>
              <div className="space-y-2">
                {annotations.length === 0 && (
                  <p className="text-white/60 text-sm">No annotations yet.</p>
                )}
                {annotations.map(a => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between bg-white/5 rounded px-3 py-2 ${activeId === a.id ? "ring-2 ring-blue-400/60" : ""}`}
                  >
                    <div className="text-sm">
                      <button
                        className="underline decoration-dotted mr-2"
                        onClick={() => setActiveId(a.id === activeId ? null : a.id)}
                        title="Click to edit via drag handles"
                      >
                        {a.id}
                      </button>
                      <span className="uppercase text-white/70">{a.layer}</span>{" "}
                      <span className="text-white/90">[{a.start}, {a.end})</span>{" "}
                      <span className="text-white/70">→</span>{" "}
                      <span className="text-white/90">{a.assetId}</span>
                    </div>
                    <button onClick={() => removeAnnotation(a.id)} className="text-red-300 hover:text-red-200 text-sm">
                      remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Ambience overlap warning */}
              {ambienceOverlaps.length > 0 && (
                <div className="mt-3 text-sm text-yellow-300">
                  <div className="font-medium">Ambience overlaps detected:</div>
                  <ul className="list-disc ml-5">
                    {ambienceOverlaps.map(([a, b], i) => (
                      <li key={i}>{a} overlaps {b}</li>
                    ))}
                  </ul>
                  <div className="text-white/70">
                    Consider crossfading or splitting regions in the next iteration.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: interactive preview with drag handles */}
          <div className="space-y-4">
            <h2 className="font-medium">Preview (drag handles appear when an annotation is selected)</h2>
            <RangePreviewEditor
              body={body}
              annotations={annotations}
              activeId={activeId ?? undefined}
              onChangeActive={(id) => setActiveId(id)}
              onUpdateAnnotation={updateAnnotation}
            />

            <div className="flex gap-3">
              <button
                onClick={realignAll}
                className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                title="Attempt to re-anchor ranges using stored anchor.text"
              >
                Realign annotations
              </button>
            </div>

            <h2 className="font-medium mt-6">Export JSON</h2>
            <textarea
              readOnly
              className="w-full h-64 rounded-md bg-white/5 px-3 py-2 font-mono text-xs"
              value={JSON.stringify(exported, null, 2)}
            />
            <div className="flex gap-3">
              <button onClick={copyJson} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                Copy JSON
              </button>
              <button onClick={loadIntoReader} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                Preview in Reader
              </button>
            </div>

            <h2 className="font-medium mt-6">Import JSON (paste)</h2>
            <textarea
              className="w-full h-40 rounded-md bg-white/5 px-3 py-2 font-mono text-xs"
              placeholder='Paste a story JSON here, then click "Import".'
              onChange={e => {
                try {
                  const obj = JSON.parse(e.target.value);
                  setTitle(obj.title ?? "Untitled");
                  setBody(obj.body ?? "");
                  setAnnotations(Array.isArray(obj.annotations) ? obj.annotations : []);
                  setAssets(Array.isArray(obj.assets) ? obj.assets : []);
                  setError(null);
                } catch {
                  // ignore while typing
                }
              }}
            />

            <h2 className="font-medium mt-6">Add Asset (bare-bones)</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="rounded bg-white/5 px-2 py-1"
                placeholder="id"
                value={assetForm.id}
                onChange={e => setAssetForm(s => ({ ...s, id: e.target.value }))}
              />
              <input
                className="rounded bg-white/5 px-2 py-1 w-64"
                placeholder="url"
                value={assetForm.url}
                onChange={e => setAssetForm(s => ({ ...s, url: e.target.value }))}
              />
              <select
                className="rounded bg-white/5 px-2 py-1"
                value={assetForm.kind}
                onChange={e => setAssetForm(s => ({ ...s, kind: e.target.value as any }))}
              >
                <option value="sfx">sfx</option>
                <option value="ambience">ambience</option>
              </select>
              <button onClick={addAsset} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Add</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
