/**
 * Existing worker — plain fetch handler, no framework.
 * Shows cf-deploy works with any wrangler project, no framework needed.
 */

interface Env {
  ASSETS: Fetcher;
  APP_VERSION?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        version: env.APP_VERSION || "dev",
        timestamp: new Date().toISOString(),
      });
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
