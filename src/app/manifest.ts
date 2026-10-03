import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solara Energy Monitor",
    short_name: "Solara",
    description: "Your energy, understood.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#12654d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
