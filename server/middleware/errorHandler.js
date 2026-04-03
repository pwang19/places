function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);

  // NOT NULL violation on price_range: DB not migrated for optional price
  if (
    err.code === "23502" &&
    (err.column === "price_range" ||
      /null value.*price_range|price_range.*not null/i.test(
        String(err.message || err.detail || "")
      ))
  ) {
    return res.status(503).json({
      status: "Error",
      message:
        "This database still requires a price for every place. From the server folder run: npm run allowNullPriceRange",
    });
  }

  const status = err.statusCode || err.status || 500;
  const message =
    status === 500 ? "Something went wrong" : err.message || "Request failed";
  res.status(status).json({ status: "Error", message });
}

module.exports = errorHandler;
