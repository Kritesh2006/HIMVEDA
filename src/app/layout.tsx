import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource-variable/schibsted-grotesk/index.css";
import "@fontsource/mukta/devanagari-400.css";
import "@fontsource/mukta/devanagari-600.css";
import "@/styles/base.css";
import { SITE_URL } from "@/lib/site";
import { getContent } from "@/server/content/service";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: c["seo.title"], template: "%s — HIMVEDA" },
    description: c["seo.description"],
    applicationName: "HIMVEDA",
    openGraph: { type: "website", siteName: "HIMVEDA", url: SITE_URL, title: c["seo.title"], description: c["seo.description"], locale: "en_US" },
    twitter: { card: "summary_large_image", title: c["seo.title"], description: c["seo.description"] },
    icons: { icon: "/icon.svg" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#173a2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
