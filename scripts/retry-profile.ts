import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateOneProfile } from "@/lib/updaters";

async function main() {
  const slug = process.argv[2];
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
  if (!team) throw new Error(`No team for slug ${slug}`);
  const result = await updateOneProfile(team);
  console.log(result);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
