// data/sampleStory.ts
export type Annotation = {
  id: string;
  start: number;    // character offset inclusive
  end: number;      // character offset exclusive
  layer: "sfx" | "ambience";
  assetId: string;
  volume?: number;  // 0..1
  loop?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  trigger?: "hover" | "enter" | "dwell";
  cooldownMs?: number;
  repeatable?: boolean;
   // NEW: anchor context to help realign after text edits
  anchor?: {
    text: string;     // exact annotated substring at creation time
    prefix?: string;  // a bit before
    suffix?: string;  // a bit after
    };  
};

export type Asset = {
  id: string;
  url: string;
  kind: "sfx" | "ambience";
};

export type Story = {
  id: string;
  title: string;
  body: string;            // plain text
  annotations: Annotation[];
  assets: Asset[];
};

const body = `There was a knock on the door. The room fell silent.`;

export const sampleStory: Story = {
  id: "sample-001",
  title: "The Knock",
  body,
  assets: [
    { id: "ambient-1", url: "/audio/ambient.mp3", kind: "ambience" },
    { id: "knock-1",   url: "/audio/knock.mp3",   kind: "sfx" }
  ],
  annotations: [
    // Play ambience across the whole text
    { id: "amb-01", start: 0, end: body.length, layer: "ambience", assetId: "ambient-1", loop: true, volume: 0.35, fadeInMs: 300, fadeOutMs: 300 },
    // Trigger SFX when hovering the word "knock"
    // (char offsets match the substring "knock"; this is fine for MVP)
    { id: "sfx-01", start: body.indexOf("knock"), end: body.indexOf("knock") + "knock".length, layer: "sfx", assetId: "knock-1", trigger: "hover", cooldownMs: 800 }
  ]
};
