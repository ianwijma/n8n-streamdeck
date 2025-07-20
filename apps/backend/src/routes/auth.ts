import { Router, type Router as ExpressRouter } from 'express';
import { AuthController } from '../controllers/authController';
import { AuthMiddleware, createRateLimiter } from '../middleware/auth';
import { AuthService } from '../services/authService';

const router: ExpressRouter = Router();

// Initialize services
const authService = new AuthService();
const authController = new AuthController(authService);
const authMiddleware = new AuthMiddleware(authService);

// Rate limiters
const loginRateLimit = createRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts'
); // 5 attempts per 15 minutes
const setupRateLimit = createRateLimiter(
  60 * 60 * 1000,
  3,
  'Too many setup attempts'
); // 3 attempts per hour
const passwordChangeRateLimit = createRateLimiter(
  60 * 60 * 1000,
  3,
  'Too many password change attempts'
); // 3 attempts per hour

// Public routes (no authentication required)
router.get('/setup/check', authController.checkSetup);

// Setup routes (only available when setup is required)
router.post(
  '/setup',
  authMiddleware.checkSetup,
  setupRateLimit,
  AuthController.setupValidation,
  authController.setup
);

// Authentication routes
router.post(
  '/login',
  loginRateLimit,
  AuthController.loginValidation,
  authController.login
);

router.post(
  '/refresh',
  AuthController.refreshTokenValidation,
  authController.refreshToken
);

router.post('/logout', authMiddleware.authenticate, authController.logout);

// Protected routes (authentication required)
router.get('/profile', authMiddleware.authenticate, authController.getProfile);

router.post(
  '/change-password',
  authMiddleware.authenticate,
  passwordChangeRateLimit,
  AuthController.changePasswordValidation,
  authController.changePassword
);

// Session management routes
router.get(
  '/sessions',
  authMiddleware.authenticate,
  authController.getSessions
);

router.delete(
  '/sessions/:sessionId',
  authMiddleware.authenticate,
  authController.revokeSession
);

router.delete(
  '/sessions',
  authMiddleware.authenticate,
  authController.revokeAllSessions
);

// Admin routes (admin authentication required)
router.get(
  '/admin/security-events',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  authController.getSecurityEvents
);

router.get(
  '/admin/login-attempts',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  authController.getLoginAttempts
);

router.get(
  '/admin/active-sessions',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  authController.getActiveSessions
);

export { router as authRouter, authService, authMiddleware };
