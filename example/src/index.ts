/**
 * cf-deploy example worker — Hono + Cloudflare Workers Static Assets.
 */
import { Hono } from "hono";

type Bindings = { ASSETS: Fetcher };

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
  })
);

// Serve static assets for all other routes
app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
