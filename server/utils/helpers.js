// Wrap async route handlers so errors reach the error middleware
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const httpError = (status, message) => Object.assign(new Error(message), { status });

export const isHttpUrl = (s) => {
  try {
    return ['http:', 'https:'].includes(new URL(String(s)).protocol);
  } catch {
    return false;
  }
};
