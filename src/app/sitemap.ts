import type { MetadataRoute } from "next";
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
  "/sdk",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
