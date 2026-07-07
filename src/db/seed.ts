import { db } from "./index";
import { teams } from "./schema";

const TEAMS: (typeof teams.$inferInsert)[] = [
  { slug: "tottenham-hotspur", name: "Tottenham Hotspur", sport: "soccer", league: "Premier League", country: "England" },
  { slug: "lafc", name: "LAFC", sport: "soccer", league: "MLS", country: "USA" },
  { slug: "gamba-osaka", name: "Gamba Osaka", sport: "soccer", league: "J1 League", country: "Japan" },
  { slug: "jeonbuk-hyundai-motors", name: "Jeonbuk Hyundai Motors", sport: "soccer", league: "K League 1", country: "South Korea" },

  { slug: "la-dodgers", name: "LA Dodgers", sport: "baseball", league: "MLB", country: "USA" },
  { slug: "orix-buffaloes", name: "Orix Buffaloes", sport: "baseball", league: "NPB", country: "Japan" },
  { slug: "nc-dinos", name: "NC Dinos", sport: "baseball", league: "KBO", country: "South Korea" },

  { slug: "la-rams", name: "LA Rams", sport: "football", league: "NFL", country: "USA" },

  { slug: "anaheim-ducks", name: "Anaheim Ducks", sport: "hockey", league: "NHL", country: "USA" },

  { slug: "la-clippers", name: "LA Clippers", sport: "basketball", league: "NBA", country: "USA" },
];

async function main() {
  for (const team of TEAMS) {
    await db.insert(teams).values(team).onConflictDoNothing({ target: teams.slug });
  }
  console.log(`Seeded ${TEAMS.length} teams.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
