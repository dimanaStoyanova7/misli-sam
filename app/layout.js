// Onest is a typeface designed with Cyrillic in mind; served from the app itself.
import "@fontsource/onest/cyrillic-400.css";
import "@fontsource/onest/cyrillic-500.css";
import "@fontsource/onest/cyrillic-600.css";
import "@fontsource/onest/cyrillic-700.css";
import "@fontsource/onest/latin-400.css";
import "@fontsource/onest/latin-600.css";
import "@fontsource/onest/latin-700.css";
// Literata: a book typeface with full Cyrillic, used for the material itself (what students read).
import "@fontsource/literata/cyrillic-400.css";
import "@fontsource/literata/cyrillic-400-italic.css";
import "@fontsource/literata/cyrillic-600.css";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-400-italic.css";
import "@fontsource/literata/latin-600.css";
import "./globals.css";

export const metadata = {
  title: "Мисли сам – материали, които карат учениците да мислят",
  description: "Качете учебен материал и получете конкретни предложения как да го направите по-устойчив на използване на изкуствен интелект.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#f2f0f7" };

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
