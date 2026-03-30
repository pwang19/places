require("dotenv").config();
const express = require("express");
const cors = require("cors");
const tagsRouter = require("./routes/tags");
const placesRouter = require("./routes/places");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

if (process.env.NODE_ENV !== "production") {
  const morgan = require("morgan");
  app.use(morgan("dev"));
}

app.use("/api/v1/tags", tagsRouter);
app.use("/api/v1/places", placesRouter);

app.use((req, res) => {
  res.status(404).json({ status: "Error", message: "Not found" });
});

app.use(errorHandler);

module.exports = app;
