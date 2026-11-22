const { ITSMException } = require('../exceptions/AppExceptions');

function errorMiddleware(err, req, res, next) {
  if (err instanceof ITSMException) {
    return res.status(err.statusCode).json(err.toJSON());
  }
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      type: err.name || 'InternalServerError',
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred.',
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = { errorMiddleware };
