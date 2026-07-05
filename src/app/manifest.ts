import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Sports",
    short_name: "My Sports",
    description: "Your favorite teams, auto-updated.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1f",
    theme_color: "#0a0f1f",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
