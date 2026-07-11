import type { MetadataRoute } from "next";
import { listProposals } from "@/lib/proposals";
import { SITE_URL } from "@/lib/site";

const PAGES = [
  "",
  "/spec",
  "/schemas",
  "/playground",
  "/verify",
  "/implementations",
  "/conformance",
  "/governance",
  "/proposals",
  "/sdk",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    ...PAGES,
    ...listProposals().map((p) => `/proposals/${p.slug}`),
  ];
  return pages.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
