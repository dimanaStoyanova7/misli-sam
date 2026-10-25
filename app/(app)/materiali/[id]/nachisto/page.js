import { notFound } from "next/navigation";

export const metadata = { title: "Начисто – Мисли сам" };

export default async function CleanVersionPage({ params }) {
  if (!/^\d+$/.test((await params).id)) notFound();
  return null;
}
