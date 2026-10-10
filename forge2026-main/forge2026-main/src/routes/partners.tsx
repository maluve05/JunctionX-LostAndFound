import { createFileRoute } from "@tanstack/react-router";
import { wideReady } from "@/components/layout";
import { Split } from "@/components/Split";
import { PhonePartners } from "@/components/phone/PhonePartners";
import { WidePartners } from "@/components/story/wide";
import { PARTNER_FAQS } from "@/components/story/content";
import { subpageHead } from "@/components/story/sub/seo";

export const Route = createFileRoute("/partners")({
  head: () =>
    subpageHead({
      path: "/partners",
      crumb: "Partners",
      title: "Partner with FORGe 2026 | Hackathon Sponsorship in Lisbon",
      description:
        "Sponsor FORGe 2026, Portugal's biggest hackathon. Put your product in front of builders from Portugal and beyond, back a challenge track and meet top talent in Lisbon during Web Summit week, November 2026.",
      faqs: PARTNER_FAQS,
    }),
  loader: () => wideReady(WidePartners),
  component: PartnersPage,
});

function PartnersPage() {
  return <Split phone={PhonePartners} wide={WidePartners} />;
}
