// PT Serif: everything you read, like a printed handout (designed for Cyrillic).
import "@fontsource/pt-serif/cyrillic-400.css";
import "@fontsource/pt-serif/cyrillic-400-italic.css";
import "@fontsource/pt-serif/cyrillic-700.css";
import "@fontsource/pt-serif/latin-400.css";
import "@fontsource/pt-serif/latin-400-italic.css";
import "@fontsource/pt-serif/latin-700.css";
// Caveat: handwriting, used only for the red-pen marks.
import "@fontsource/caveat/cyrillic-500.css";
import "@fontsource/caveat/cyrillic-700.css";
import "@fontsource/caveat/latin-500.css";
import "@fontsource/caveat/latin-700.css";
import "./globals.css";

export const metadata = {
  title: "Мисли сам – материали, които карат учениците да мислят",
  description: "Дайте задачата си и колега ще я прегледа с червен химикал: кои места ученикът лесно би дал на ИИ и как да ги пренапишете.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#e7e3da" };

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
