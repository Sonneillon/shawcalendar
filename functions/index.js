/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });

const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const secretClient = new SecretManagerServiceClient();

// ---- Config ----
const METOFFICE_SECRET_RESOURCE = process.env.METOFFICE_SECRET_RESOURCE; // projects/<id>/secrets/<name>/versions/latest
const METOFFICE_URL = process.env.METOFFICE_URL; // https://api.metoffice.gov.uk/datahub/forecast/spot

// Fixed coords (Daresbury)
const LAT = 53.333871;
const LON = -2.641248;

// Cache the API key in-memory to reduce Secret Manager calls
let cachedApiKey = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

// Upstream timeout (ms)
const UPSTREAM_TIMEOUT_MS = 8000;

setGlobalOptions({ maxInstances: 10 });

// ---- Helpers ----
function requireEnv(name, value) {
  if (!value) throw new Error(`${name} environment variable is not set`);
}

async function getMetOfficeApiKey() {
  const nowMs = Date.now();
  if (cachedApiKey && nowMs - cachedAtMs < CACHE_TTL_MS) return cachedApiKey;

  requireEnv("METOFFICE_SECRET_RESOURCE", METOFFICE_SECRET_RESOURCE);

  const [version] = await secretClient.accessSecretVersion({
    name: METOFFICE_SECRET_RESOURCE,
  });

  const data = version?.payload?.data;
  const key = Buffer.isBuffer(data) ? data.toString("utf8").trim() : "";
  if (!key) throw new Error("Met Office API key secret payload was empty/unreadable");

  cachedApiKey = key;
  cachedAtMs = nowMs;
  return key;
}

function buildMetOfficeUrl(baseUrl, lat, lon) {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  return url.toString();
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function logError(message, err, extra) {
  logger.error(message, {
    err: err?.message || String(err),
    ...(extra || {}),
  });
}

// ---- Function ----
exports.metofficeForecast = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      requireEnv("METOFFICE_URL", METOFFICE_URL);

      const apiKey = await getMetOfficeApiKey();
      const url = buildMetOfficeUrl(METOFFICE_URL, LAT, LON);

      let upstreamRes;
      try {
        upstreamRes = await fetchWithTimeout(
          url,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              apikey: apiKey, // DataHub uses "apikey"
            },
          },
          UPSTREAM_TIMEOUT_MS,
        );
      } catch (err) {
        logError("Met Office fetch failed", err);
        res.status(502).json({ error: "Failed to reach Met Office" });
        return;
      }

      const text = await upstreamRes.text();

      if (!upstreamRes.ok) {
        // Don’t log body (could be large); status is enough for standard ops logging.
        logger.error("Met Office upstream error", { status: upstreamRes.status });
        res.status(502).json({
          error: "Upstream Met Office API error",
          status: upstreamRes.status,
        });
        return;
      }

      let metOffice;
      try {
        metOffice = JSON.parse(text);
      } catch {
        // If upstream returns non-JSON despite 200, treat as bad gateway.
        logger.error("Met Office returned non-JSON response");
        res.status(502).json({ error: "Met Office returned invalid response" });
        return;
      }

      // Standard cache headers: adjust if you want browser caching.
      res.set("Cache-Control", "no-store");

      res.status(200).json({
        latitude: LAT,
        longitude: LON,
        metOffice,
      });
    } catch (err) {
      logError("Internal error in metofficeForecast", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
