import { Router } from "express";
import { db, regionsTable } from "@workspace/db";

const router = Router();

router.get("/", async (_req, res) => {
  const regions = await db.select().from(regionsTable).orderBy(regionsTable.name);
  res.json(regions);
});

export default router;
