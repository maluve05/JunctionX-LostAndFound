import { createFileRoute } from "@tanstack/react-router";
import { wideReady } from "@/components/layout";
import { Split } from "@/components/Split";
import { PhoneHome } from "@/components/phone/PhoneHome";
import { WideHome } from "@/components/story/wide";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FORGe 2026: Portugal's Biggest Hackathon | Lisbon" },
      {
        name: "description",
        content:
          "FORGe is Portugal's biggest hackathon. Builders from Portugal and beyond form teams around real partner challenges and ship to a public demo. Lisbon, November 2026, during Web Summit week.",
      },
      { property: "og:title", content: "FORGe 2026: Portugal's Biggest Hackathon" },
      { property: "og:url", content: "https://forgehackathon.com/" },
      {
        property: "og:description",
        content: "One room. One weekend. Lisbon, November 2026, during Web Summit week.",
      },
    ],
    links: [{ rel: "canonical", href: "https://forgehackathon.com/" }],
  }),
  loader: () => wideReady(WideHome),
  component: Index,
});

/** The home page: the story on a phone, the 3D story on anything wider. */
function Index() {
  return <Split phone={PhoneHome} wide={WideHome} />;
}
