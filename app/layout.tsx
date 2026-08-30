import type { Metadata } from "next";
import "./globals.css";
import "./workflow.css";
import RegisterServiceWorker from "./register-service-worker";

export const metadata: Metadata = {
  metadataBase: new URL("https://stampstaff-prototype.langaz35.chatgpt.site"),
  title: "StamStaff — Simple event rostering",
  description:
    "A fictional local prototype for reserving event shift places and manager-confirmed rostering.",
  applicationName: "StamStaff",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "StamStaff",
    description: "Reserve a place. Manager confirms.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 864,
        alt: "StamStaff — Reserve a place. Manager confirms.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StamStaff",
    description: "Reserve a place. Manager confirms.",
    images: ["/og.png"],
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
