import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpsEngine Enterprise Platform",
    short_name: "OpsEngine",
    description:
      "Multi-tenant cloud operations, attendance, DAR, and approvals for software enterprises.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0B0F17",
    theme_color: "#3B82F6",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Daily Attendance",
        short_name: "Attendance",
        description: "Check in or check out of daily attendance",
        url: "/dashboard/attendance",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Today's Work Plan",
        short_name: "Daily Plan",
        description: "View and manage today's work plan",
        url: "/dashboard/daily-plan",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Pending Approvals",
        short_name: "Approvals",
        description: "Review and approve pending business decisions",
        url: "/dashboard/approvals",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Daily Activity Report (DAR)",
        short_name: "DAR",
        description: "Submit today's daily activity report",
        url: "/dashboard/time-reporting",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
