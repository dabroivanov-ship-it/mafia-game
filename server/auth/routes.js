import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { findUserByUsername, findUserByEmail, findUserById, createUser } from './db.js';
import { signToken, authMiddleware } from './jwt.js';

const router = Router();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    totalScore: user.total_score,
    createdAt: user.created_at,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const u = username.trim();
    const e = email.trim().toLowerCase();

    if (u.length < 3 || u.length > 20) {
      return res.status(400).json({ error: 'Логин: от 3 до 20 символов' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      return res.status(400).json({ error: 'Логин: только буквы, цифры и _' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль: минимум 6 символов' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    if (findUserByUsername(u)) {
      return res.status(409).json({ error: 'Логин уже занят' });
    }
    if (findUserByEmail(e)) {
      return res.status(409).json({ error: 'Email уже зарегистрирован' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const name = (displayName?.trim() || u).slice(0, 20);

    const user = createUser({
      username: u,
      email: e,
      passwordHash,
      displayName: name,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login?.trim() || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const value = login.trim();
    const user =
      findUserByUsername(value) ||
      findUserByEmail(value.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user: publicUser(user) });
});

export default router;
