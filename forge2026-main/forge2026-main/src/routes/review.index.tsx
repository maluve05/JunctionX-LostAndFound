import { createFileRoute } from "@tanstack/react-router";
import applyCss from "../apply.css?url";
import { Review } from "@/components/apply/Review";

/*
  /review: the team's page for reading and judging applications. Cloudflare
  Access guards it at the edge, and its data (review.api.$.ts) checks the
  Access token again, so the page itself holds nothing until the API answers.
*/
export const Route = createFileRoute("/review/")({
  head: () => ({
    meta: [
      { title: "Applications | FORGe team" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: applyCss }],
  }),
  component: Review,
});
