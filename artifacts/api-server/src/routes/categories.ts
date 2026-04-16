import { Router } from "express";
import { db, categoriesTable, listingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const categories = await db.select({
    id: categoriesTable.id,
    name: categoriesTable.name,
    slug: categoriesTable.slug,
    icon: categoriesTable.icon,
    listingCount: sql<number>`count(${listingsTable.id})::int`,
  })
    .from(categoriesTable)
    .leftJoin(listingsTable, sql`${listingsTable.categoryId} = ${categoriesTable.id} AND ${listingsTable.isAvailable} = true`)
    .groupBy(categoriesTable.id)
    .orderBy(categoriesTable.name);

  res.json(categories);
});

export default router;
