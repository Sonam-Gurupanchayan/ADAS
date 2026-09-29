import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Firmware Hub",
    short_name: "Firmware",
    description: "Download approved firmware for your sensors",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f17",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
