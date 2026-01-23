/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });

const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const secretClient = new SecretManagerServiceClient();

//const METOFFICE_SECRET = `projects/775795543848/secrets/MetOfficeAPIKey/versions/latest`;
const METOFFICE_SECRET = process.env.METOFFICE_SECRET_RESOURCE;
const METOFFICE_URL = process.env.METOFFICE_URL;

let cachedApiKey = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mionutes

async function getMetOfficeApiKey() {
  const nowMs = Date.now();
  if (cachedApiKey && nowMs - cachedAtMs < CACHE_TTL_MS) {
    return cachedApiKey;
  }

  if (!METOFFICE_SECRET) {
    throw new Error("METOFFICE_SECRET environment variable is not set");
  }

  const [version] = await secretClient.accessSecretVersion({
    name: METOFFICE_SECRET,
  });

  const key = version.payload?.data?.toString("utf8").trim();
  if (!key) {
    throw new Error("Failed to retrieve Met Office API key from Secret Manager");
  }

  cachedApiKey = key;
  cachedAtMs = nowMs;
  return key;
}

exports.metofficeForecast = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Fixed coords per your request
      const lat = 53.333871;
      const lon = -2.641248;

      if (!METOFFICE_URL) {
        res.status(500).json({
          error: "METOFFICE_URL environment variable is not set",
        });
        return;
      }

      const apiKey = await getMetOfficeApiKey();
      const url = `${METOFFICE_URL}?key=${apiKey}&lat=${lat}&lon=${lon}`;

      const upstreamRes = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });

      const text = await upstreamRes.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!upstreamRes.ok) {
        logger.error("Met Office API error", {
          status: upstreamRes.status,
          body: data,
        });
        res.status(502).json({
          error: "Upstream Met Office API error",
          status: upstreamRes.status,
          body: data,
        });
        return;
      }

      res.status(200).json({
        latitude: lat,
        longitude: lon,
        metOffice: data,
      });
    } catch (error) {
      logger.error("Internal error in metofficeForecast", { error });
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
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
