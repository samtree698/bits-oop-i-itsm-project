const { UnauthorizedOperationException } = require('../exceptions/AppExceptions');

function createAuthMiddleware(authService, userRepository) {
  const authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const decoded = authService.verifyToken(token);
      const user = await userRepository.findByKey(decoded.sub);
      if (!user || !user.active) {
        throw new UnauthorizedOperationException('User account is inactive or no longer exists.');
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };

  const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return next(
          new UnauthorizedOperationException(
            `Access denied. Required role: [${allowedRoles.join(', ')}], current role: '${req.user?.role || 'NONE'}'.`
          )
        );
      }
      next();
    };
  };

  return { authenticate, authorizeRoles };
}

module.exports = { createAuthMiddleware };
