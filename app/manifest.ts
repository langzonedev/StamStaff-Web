import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StamStaff Prototype",
    short_name: "StamStaff",
    description:
      "A fictional prototype for simple event availability and rostering.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f4fa",
    theme_color: "#250861",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
