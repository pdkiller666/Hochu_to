import { Layout } from "@/components/layout/Layout";
import { Hero } from "@/components/promo/Hero";
import { TrustCards } from "@/components/promo/TrustCards";
import { OwnerSteps } from "@/components/promo/OwnerSteps";
import { CaseStudies } from "@/components/promo/CaseStudies";
import { FinalCTA } from "@/components/promo/FinalCTA";

export default function PromoHub() {
  return (
    <Layout>
      <main className="overflow-x-hidden">
        <Hero />
        <TrustCards />
        <OwnerSteps />
        <CaseStudies />
        <FinalCTA />
      </main>
    </Layout>
  );
}
