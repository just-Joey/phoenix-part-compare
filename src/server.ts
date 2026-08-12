import "dotenv/config";
import express from "express";
import cors from "cors";
import { compareRouter } from "./routes/compare";
import { specSearchRouter } from "./routes/specSearch";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api", compareRouter);
app.use("/api", specSearchRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`phoenix-part-compare API listening on http://localhost:${port}`);
});
