import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

function makeRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** In-memory rate limiter — no dependencies, sufficient for a single-process low-resource server. */
function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of hits) {
      if (entry.resetAt <= cutoff) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader("x-ratelimit-limit", String(max));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader("retry-after", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        ok: false,
        request_id: res.locals.requestId || "",
        error: "rate_limited",
        detail: "请求过于频繁，请稍后再试",
      });
    }
    next();
  };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.locals.requestId = makeRequestId();
  res.setHeader("x-request-id", res.locals.requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, "127.0.0.1", () => {
  console.log(`http://localhost:${port}`);
});
