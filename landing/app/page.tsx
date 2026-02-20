import { Hero } from "./components/hero";
import { Timeline } from "./components/timeline";
import { DownloadSection } from "./components/download-section";
import { Footer } from "./components/footer";
import { featureSections } from "./mock-data";

export default function LandingPage() {
  return (
    <main className="bg-cream-50 min-h-screen overflow-x-hidden">
      {/* Hero */}
      <Hero />

      {/* Feature timeline */}
      <Timeline sections={featureSections} />

      {/* Download */}
      <DownloadSection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
