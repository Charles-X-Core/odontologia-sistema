const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 5;
  const blockMs = 15 * 60 * 1000;

  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { attempts: 0, resetAt: now + windowMs, blockedUntil: 0 });
  }

  const data = loginAttempts.get(ip);

  if (data.blockedUntil > now) {
    const remaining = Math.ceil((data.blockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${remaining} segundos.`
    });
  }

  if (now > data.resetAt) {
    data.attempts = 0;
    data.resetAt = now + windowMs;
  }

  data.attempts++;

  if (data.attempts > maxAttempts) {
    data.blockedUntil = now + blockMs;
    data.attempts = 0;
    console.log(`[RATE-LIMIT] IP ${ip} bloqueada por 15 minutos (${data.attempts} intentos)`);
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.'
    });
  }

  next();
}

function registrarIntentoFallido(ip) {
  const now = Date.now();
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { attempts: 0, resetAt: now + 60000, blockedUntil: 0 });
  }
}

function limpiarIntentos(ip) {
  loginAttempts.delete(ip);
}

module.exports = { rateLimitLogin, registrarIntentoFallido, limpiarIntentos };
