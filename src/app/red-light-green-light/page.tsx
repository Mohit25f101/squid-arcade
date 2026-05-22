import RedLightGreenLight from "@/components/games/RedLightGreenLight";

export const metadata = {
  title: "Red Light Green Light — Squid Arcade",
};

export default function RedLightGreenLightPage() {
  return (
    <div className="w-full h-[100dvh] overflow-hidden">
      <RedLightGreenLight />
    </div>
  );
}