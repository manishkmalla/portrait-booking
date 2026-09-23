import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    // Set by requireUser after verifying the JWT cookie.
    user?: { id: string; role: 'client' | 'photographer' };
  }
}
