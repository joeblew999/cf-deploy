import { Hono } from "hono";

type Bindings = { ASSETS: Fetcher; APP_VERSION?: string };

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    version: c.env.APP_VERSION || "dev",
    timestamp: new Date().toISOString(),
  })
);

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
