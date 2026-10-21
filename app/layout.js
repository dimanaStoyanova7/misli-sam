// Onest is a typeface designed with Cyrillic in mind; served from the app itself.
import "@fontsource/onest/cyrillic-400.css";
import "@fontsource/onest/cyrillic-500.css";
import "@fontsource/onest/cyrillic-600.css";
import "@fontsource/onest/cyrillic-800.css";
import "@fontsource/onest/latin-400.css";
import "@fontsource/onest/latin-600.css";
import "@fontsource/onest/latin-800.css";
import "./globals.css";

export const metadata = {
  title: "Мисли сам – материали, които карат учениците да мислят",
  description: "Качете учебен материал и получете конкретни предложения как да го направите по-устойчив на използване на изкуствен интелект.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f1fa" };

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
