import { connection } from "next/server";
import MapExplorer from "@/components/map/MapExplorer";
import { firstPartyKey } from "@/lib/keys";

export const metadata = {
  title: "HeisynMaps — Explore Delhi NCR",
  description: "Search places, get car, bike, scooter and truck directions, and find any DIGIPIN.",
};

export default async function MapsPage() {
  await connection(); // key is derived from the runtime secret, so render per request
  return <MapExplorer apiKey={firstPartyKey()} />;
}
