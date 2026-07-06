import { MarketingNav } from "@/components/layout/MarketingNav";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-[#020617]">
      <MarketingNav />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
