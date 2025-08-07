const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

let hashedPassword = null;

const initializeAuth = async () => {
  hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
};

const authenticateUser = async (username, password) => {
  if (!hashedPassword) {
    await initializeAuth();
  }

  if (username !== ADMIN_USERNAME) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, hashedPassword);
  if (!isValidPassword) {
    return null;
  }

  const token = jwt.sign(
    { username: ADMIN_USERNAME, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return token;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token di accesso richiesto' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token non valido' });
  }

  req.user = decoded;
  next();
};

module.exports = {
  authenticateUser,
  verifyToken,
  authMiddleware,
  initializeAuth
};