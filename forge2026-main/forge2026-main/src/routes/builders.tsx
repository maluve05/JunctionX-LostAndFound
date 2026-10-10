import { createFileRoute } from "@tanstack/react-router";
import { wideReady } from "@/components/layout";
import { Split } from "@/components/Split";
import { PhoneBuilders } from "@/components/phone/PhoneBuilders";
import { WideBuilders } from "@/components/story/wide";
import { BUILDER_FAQS, SITE_URL } from "@/components/story/content";
import { subpageHead } from "@/components/story/sub/seo";

export const Route = createFileRoute("/builders")({
  head: () =>
    subpageHead({
      path: "/builders",
      crumb: "Builders",
      title: "Apply to FORGe 2026 | Hackathon in Lisbon for Builders",
      description:
        "Join developers, designers, founders and students from Portugal and beyond at FORGe 2026, Portugal's biggest hackathon. One weekend in Lisbon during Web Summit week, November 2026. Solo or with a team.",
      faqs: BUILDER_FAQS,
      extraJsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Event",
          name: "FORGe 2026",
          description:
            "Portugal's biggest hackathon. Builders from Portugal and beyond form teams around real partner challenges and ship to a public demo.",
          startDate: "2026-11",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          url: `${SITE_URL}/builders`,
          image: `${SITE_URL}/og/forge-2026-v2.png`,
          location: {
            "@type": "Place",
            name: "Lisbon",
            address: { "@type": "PostalAddress", addressLocality: "Lisbon", addressCountry: "PT" },
          },
          organizer: { "@type": "Organization", name: "NOVAe", url: "https://unlnovae.org" },
        },
      ],
    }),
  loader: () => wideReady(WideBuilders),
  component: BuildersPage,
});

function BuildersPage() {
  return <Split phone={PhoneBuilders} wide={WideBuilders} />;
}
