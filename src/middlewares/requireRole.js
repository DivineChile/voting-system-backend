export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    const userRole = req.profile?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
}