import GlassBridge from '@/components/games/GlassBridge';

export const metadata = {
  title: "Glass Bridge — Squid Arcade",
};

export default function GlassBridgePage() {
  return (
    <div className="w-full h-[100dvh] overflow-hidden">
      <GlassBridge />
    </div>
  );
}