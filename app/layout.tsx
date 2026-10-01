import type { Metadata } from "next";
import "./globals.css";
import "./workflow.css";
import RegisterServiceWorker from "./register-service-worker";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stampstaff-prototype.langaz35.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(new URL(siteUrl).origin),
  title: "StamStaff — Simple event rostering",
  description:
    "A fictional local prototype for staff availability and manager-assigned event rostering.",
  applicationName: "StamStaff",
  manifest: `${basePath}/manifest.webmanifest`,
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
