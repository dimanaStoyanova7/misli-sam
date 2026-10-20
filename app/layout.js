import "./globals.css";

export const metadata = {
  title: "Мисли сам – задачи, които карат учениците да мислят",
  description: "Качете задача и получете конкретни предложения как да я направите по-устойчива на използване на изкуствен интелект.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f2ea" };

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap&subset=cyrillic"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
