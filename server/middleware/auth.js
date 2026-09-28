import jwt from 'jsonwebtoken';
import { httpError } from '../utils/helpers.js';

const secret = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';

export const signToken = (payload) => jwt.sign(payload, secret(), { expiresIn: '12h' });

export const verifyToken = (token) => jwt.verify(token, secret());

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(httpError(401, 'Please log in'));
  try {
    req.user = jwt.verify(token, secret()); // { id, role }
    next();
  } catch {
    next(httpError(401, 'Session expired, please log in again'));
  }
}

export const requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : next(httpError(403, 'Not allowed'));
