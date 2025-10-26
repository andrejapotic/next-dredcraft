export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white grid place-items-center gap-4">
      <a href="/reader" className="rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20 transition">
        Open Reader POC
      </a>
      <a href="/author" className="rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20 transition">
        Open Authoring MVP
      </a>
    </main>
  );
}
