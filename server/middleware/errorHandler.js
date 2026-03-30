function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);
  const status = err.statusCode || err.status || 500;
  const message =
    status === 500 ? "Something went wrong" : err.message || "Request failed";
  res.status(status).json({ status: "Error", message });
}

module.exports = errorHandler;
