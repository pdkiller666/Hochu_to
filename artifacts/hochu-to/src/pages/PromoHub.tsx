import { Layout } from "@/components/layout/Layout";
import { Hero } from "@/components/promo/Hero";
import { Ticker } from "@/components/promo/Ticker";
import { StatsBar } from "@/components/promo/StatsBar";
import { TrustCards } from "@/components/promo/TrustCards";
import { OwnerSteps } from "@/components/promo/OwnerSteps";
import { CaseStudies } from "@/components/promo/CaseStudies";
import { FinalCTA } from "@/components/promo/FinalCTA";

export default function PromoHub() {
  return (
    <Layout>
      <main className="overflow-x-hidden">
        <Hero />
        <Ticker />
        <StatsBar />
        <TrustCards />
        <OwnerSteps />
        <CaseStudies />
        <FinalCTA />
      </main>
    </Layout>
  );
}
