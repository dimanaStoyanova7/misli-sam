import { notFound } from "next/navigation";

export const metadata = { title: "Бележки – Мисли сам" };

export default async function MaterialPage({ params }) {
  if (!/^\d+$/.test((await params).id)) notFound();
  return null;
}
