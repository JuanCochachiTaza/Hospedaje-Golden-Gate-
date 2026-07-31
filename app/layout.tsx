import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quejas y sugerencias | Hospedaje Golden Gate",
  description:
    "Formulario de atención para huéspedes del Hospedaje Golden Gate.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
