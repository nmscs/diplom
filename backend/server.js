import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');

['videos', 'covers', 'frames', 'avatars'].forEach(folder => {
  const dir = path.join(uploadDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

// Настройки
app.use(cors());
app.use(express.json());

// Раздача статических файлов
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware для проверки токена (авторизация)
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Токен отсутствует" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Неверный токен" });
  }
}

async function uploadToSupabase(file, bucketName) {
  if (!file) return null;

  const ext = path.extname(file.originalname);
  const safeName =
    Date.now() +
    '-' +
    Math.random().toString(36).substring(2, 8) +
    ext;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(safeName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(safeName);

  return data.publicUrl;
}

// --- МАРШРУТЫ АВТОРИЗАЦИИ ---

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Заполните все поля' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING id, name, username',
      [name, username, hash]
    );
    res.json(result.rows[0]);
  } catch (err) {
      console.error(err);

      if (err.code === '23505') {
        return res.status(400).json({ error: 'Пользователь уже существует' });
      }

      res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username } });
  } catch (err) {
      onsole.error("LOGIN ERROR:", err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// --- МАРШРУТЫ АНИМАЦИЙ ---

// Получить все анимации (для главной или каталога)
app.get('/api/animations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.username as author_username 
      FROM animations a 
      JOIN users u ON a.author_id = u.id 
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Получить одну анимацию по ID (для viewer.html)
app.get('/api/animations/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.*, u.username as author_username FROM animations a JOIN users u ON a.author_id = u.id WHERE a.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить анимацию (требует логина)
app.post(
  '/api/animations',
  authMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'frames', maxCount: 1000 }
  ]),
  async (req, res) => {

    console.log("FILES:", req.files);
    console.log("BODY:", req.body);

    try {
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title required' });
      }

      const video = req.files['video']?.[0];
      const cover = req.files['cover']?.[0];
      const frames = req.files['frames'] || [];

      if (!video || !cover) {
        return res.status(400).json({ error: 'Video and cover required' });
      }

      const videoPath = await uploadToSupabase(video, 'videos');
      const coverPath = await uploadToSupabase(cover, 'covers');

      const framePaths = [];

      for (const frame of frames) {
        const frameUrl = await uploadToSupabase(frame, 'frames');
        framePaths.push(frameUrl);
      }

      const result = await pool.query(
        `INSERT INTO animations (title, description, video_path, cover_path, frames, author_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [title, description, videoPath, coverPath, framePaths, req.user.id]
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка загрузки' });
    }
  }
);

// Получить анимации конкретного пользователя (для профиля)
app.get('/api/users/:username/animations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.* FROM animations a JOIN users u ON a.author_id = u.id WHERE u.username = $1',
      [req.params.username]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить профиль пользователя по username
app.get('/api/users/:username', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, avatar FROM users WHERE username = $1',
      [req.params.username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить свой профиль
app.put('/api/profile/me', authMiddleware, upload.single('avatar'), async (req, res) => {
  let { name, username } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Некорректное имя' });
  }

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username too short' });
  }

  const usernameRegex = /^[a-z0-9_]+$/;

  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Only latin letters, numbers and _ allowed' });
  }

  username = username.trim().toLowerCase();

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const currentUserResult = await pool.query(
      'SELECT avatar FROM users WHERE id = $1',
      [req.user.id]
    );

    let avatarPath = currentUserResult.rows[0]?.avatar || null;

    if (req.body.avatar === "REMOVE") {
        if (avatarPath) {
            const oldAvatarFullPath = path.join(__dirname, '..', avatarPath.replace(/^\/+/, ''));
            if (fs.existsSync(oldAvatarFullPath)) {
                fs.unlinkSync(oldAvatarFullPath);
            }
        }
        avatarPath = null;
    }
    else if (req.file) {
        avatarPath = await uploadToSupabase(req.file, 'avatars');
    }

    const result = await pool.query(
      `UPDATE users
       SET name = $1, username = $2, avatar = $3
       WHERE id = $4
       RETURNING id, name, username, avatar`,
      [name.trim(), username, avatarPath, req.user.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});


// Указываем серверу, что статические файлы (html, js, css)
// лежат в папке на один уровень выше, чем папка backend
app.use(express.static(path.join(__dirname, '../')));

// Удалить анимацию
app.delete('/api/animations/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;

    // сначала получаем анимацию
    const result = await pool.query(
      'SELECT * FROM animations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Не найдено' });
    }

    const anim = result.rows[0];

    // проверка: владелец ли это
    if (anim.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    // удаляем файлы
    const deleteFile = (filePath) => {
      if (!filePath) return;
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    };

    // удаляем только из базы
    await pool.query('DELETE FROM animations WHERE id = $1', [id]);

    if (anim.frames && anim.frames.length) {
      anim.frames.forEach(frame => deleteFile(frame));
    }

    // удаляем из базы
    await pool.query('DELETE FROM animations WHERE id = $1', [id]);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});