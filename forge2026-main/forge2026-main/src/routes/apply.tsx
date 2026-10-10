import { createFileRoute } from "@tanstack/react-router";
import applyCss from "../apply.css?url";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { getApplyState } from "@/lib/apply/apply.functions";

/*
  /apply: the builder application. A tool rather than a chapter, so it has
  no 3D scene or phone bars (see PLAIN in __root.tsx), and one layout that
  works from a phone to a monitor. Kept out of search results until
  applications open; nothing on the site links here yet.
*/
export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply to FORGe 2026 | Builder application" },
      {
        name: "description",
        content:
          "Apply to build at FORGe 2026, one weekend in Lisbon during Web Summit week, November 2026.",
      },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#14122a" },
    ],
    links: [{ rel: "stylesheet", href: applyCss }],
  }),
  loader: () => getApplyState(),
  component: ApplyPage,
});

function ApplyPage() {
  const { open, ready, siteKey } = Route.useLoaderData();
  return <ApplyForm open={open} ready={ready} siteKey={siteKey} />;
}
