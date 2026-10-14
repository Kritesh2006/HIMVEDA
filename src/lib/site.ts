export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://himvedanepal.com").replace(/\/$/, "");
export const SITE_NAME = "HIMVEDA";
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
