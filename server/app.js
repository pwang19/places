const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const tagsRouter = require("./routes/tags");
const placesRouter = require("./routes/places");
const authRouter = require("./routes/auth");
const requireAuth = require("./middleware/requireAuth");
const errorHandler = require("./middleware/errorHandler");

const app = express();

if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

function corsOrigin() {
  const raw = process.env.CLIENT_ORIGIN;
  if (raw && raw.trim()) {
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 1) return list[0];
    return list;
  }
  return "http://localhost:3000";
}

app.use(
  cors({
    origin: corsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);
app.use(cookieParser());
app.use(express.json());

if (process.env.NODE_ENV !== "production") {
  const morgan = require("morgan");
  app.use(morgan("dev"));
}

app.use("/api/v1/auth", authRouter);

const protectedV1 = express.Router();
protectedV1.use(requireAuth);
protectedV1.use("/tags", tagsRouter);
protectedV1.use("/places", placesRouter);
app.use("/api/v1", protectedV1);

app.use((req, res) => {
  res.status(404).json({ status: "Error", message: "Not found" });
});

app.use(errorHandler);

module.exports = app;
