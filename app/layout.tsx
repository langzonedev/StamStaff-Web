import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workflow.css";
import RegisterServiceWorker from "./register-service-worker";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://langzonedev.github.io/StamStaff-Web/";

export const metadata: Metadata = {
  metadataBase: new URL(new URL(siteUrl).origin),
  title: "StamStaff — Simple event rostering",
  description:
    "Share event availability and see your manager-confirmed shifts.",
  applicationName: "StamStaff",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: { url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    title: "StamStaff",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "StamStaff",
    description: "Share availability. Manager confirms shifts.",
    type: "website",
    images: [
      {
        url: `${basePath}/og.png`,
        width: 1536,
        height: 864,
        alt: "StamStaff — Share availability. Manager confirms shifts.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StamStaff",
    description: "Share availability. Manager confirms shifts.",
    images: [`${basePath}/og.png`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#13283a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
