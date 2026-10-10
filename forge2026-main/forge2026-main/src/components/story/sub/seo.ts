import { SITE_URL, type Faq } from "../content";

/**
 * Head tags shared by /builders and /partners. Each page gets its own title,
 * description and canonical URL so search engines index it as a page in its
 * own right, plus breadcrumb and FAQ structured data matching what is on it.
 */
export function subpageHead({
  path,
  title,
  description,
  crumb,
  faqs,
  extraJsonLd = [],
}: {
  path: string;
  title: string;
  description: string;
  crumb: string;
  faqs: Faq[];
  extraJsonLd?: object[];
}) {
  const url = `${SITE_URL}${path}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FORGe 2026", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: crumb, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    ...extraJsonLd,
  ];

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: jsonLd.map((data) => ({
      type: "application/ld+json",
      // Escape "<" so no string in the data can close the <script> tag early.
      children: JSON.stringify(data).replace(/</g, "\\u003c"),
    })),
  };
}
