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
import { Jimp, intToRGBA } from 'jimp';


dotenv.config();
console.log("DATABASE_URL CHECK:", process.env.DATABASE_URL?.split("@")[0]);

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

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
      `INSERT INTO users (name, username, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, username, role`,
      [name, username, hash]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username
      }
    });
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
      console.error("LOGIN ERROR:", err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// --- МАРШРУТЫ АНИМАЦИЙ ---

// Получить все анимации (для главной или каталога)
app.get('/api/animations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        u.username as author_username,

        (
          SELECT COUNT(*)
          FROM animation_likes l
          WHERE l.animation_id = a.id
        )::int as likes_count,

        (
          SELECT COUNT(*)
          FROM animation_views v
          WHERE v.animation_id = a.id
        )::int as views_count

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
    `
    SELECT 
      a.*,
      u.username as author_username,

      (
        SELECT COUNT(*)
        FROM animation_likes l
        WHERE l.animation_id = a.id
      )::int as likes_count,

      (
        SELECT COUNT(*)
        FROM animation_views v
        WHERE v.animation_id = a.id
      )::int as views_count

    FROM animations a
    JOIN users u ON a.author_id = u.id

    WHERE a.id = $1
    `,
    [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    const animation = result.rows[0];

    if (!req.headers.authorization) {
      return res.json(animation);
    }

    try {

      const token =
        req.headers.authorization.split(" ")[1];

      const decoded =
        jwt.verify(token, process.env.JWT_SECRET);

      const likedResult = await pool.query(
        `
        SELECT *
        FROM animation_likes
        WHERE animation_id = $1
        AND user_id = $2
        `,
        [req.params.id, decoded.id]
      );

      animation.liked =
        likedResult.rows.length > 0;

    } catch {}

    res.json(animation);
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
      const { title, description, duration } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title required' });
      }

      const video = req.files['video']?.[0];
      const cover = req.files['cover']?.[0];
      const frames = req.files['frames'] || [];

      if (!video || !cover) {
        return res.status(400).json({ error: 'Video and cover required' });
      }

      console.log("Uploading video...");
      const videoPath = await uploadToSupabase(video, 'videos');
      console.log("Uploading cover...");
      const coverPath = await uploadToSupabase(cover, 'covers');

      const framePaths = [];

      console.log("Uploading frames...");
      for (const frame of frames) {
        const frameUrl = await uploadToSupabase(frame, 'frames');
        framePaths.push(frameUrl);
      }

      console.log("Saving animation to database...");
      const result = await pool.query(
        `
        INSERT INTO animations
        (
          title,
          description,
          video_path,
          cover_path,
          frames,
          author_id,
          duration
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          title,
          description,
          videoPath,
          coverPath,
          framePaths,
          req.user.id,
          Number(duration) || 0
        ]
      );

      await generateAIAttention(
        result.rows[0].id,
        framePaths,
        Number(duration)
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка загрузки' });
    }
  }
);

// ОБНОВИТЬ АНИМАЦИЮ

app.put(
  '/api/animations/:id',
  authMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'frames', maxCount: 1000 }
  ]),
  async (req, res) => {

    try {

      const animationId = req.params.id;

      const existingResult = await pool.query(
        `SELECT * FROM animations WHERE id = $1`,
        [animationId]
      );

      if (!existingResult.rows.length) {
        return res.status(404).json({
          error: 'Animation not found'
        });
      }

      const existing =
        existingResult.rows[0];

      // ПРОВЕРКА ВЛАДЕЛЬЦА

      if (existing.author_id !== req.user.id) {
        return res.status(403).json({
          error: 'No access'
        });
      }

      const {
        title,
        description,
        cover_path
      } = req.body;

      console.log("REQ BODY:", req.body);
      console.log("REQ FILES:", req.files);

      let videoPath =
        existing.video_path;

      let coverPath =
        cover_path || existing.cover_path;

      let framePaths =
        existing.frames || [];

      // NEW VIDEO

      if (req.files['video']?.[0]) {

        videoPath = await uploadToSupabase(
          req.files['video'][0],
          'videos'
        );
      }

      // NEW COVER

      if (req.files['cover']?.[0]) {

        coverPath = await uploadToSupabase(
          req.files['cover'][0],
          'covers'
        );
      }

      // NEW PNGS

      if (
        req.files['frames'] &&
        req.files['frames'].length
      ) {

        framePaths = [];

        for (const frame of req.files['frames']) {

          const frameUrl =
            await uploadToSupabase(
              frame,
              'frames'
            );

          framePaths.push(frameUrl);
        }
      }

      const result = await pool.query(
        `
        UPDATE animations
        SET
          title = $1,
          description = $2,
          video_path = $3,
          cover_path = $4,
          frames = $5
        WHERE id = $6
        RETURNING *
        `,
        [
          title,
          description,
          videoPath,
          coverPath,
          framePaths,
          animationId
        ]
      );

      res.json(result.rows[0]);

    } catch (err) {

      console.error("UPDATE ERROR:");
      console.error(err);
      console.error(err?.stack);

      res.status(500).json({
          error: err.message || 'Update failed'
      });
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
    await pool.query(
      'DELETE FROM animations WHERE id = $1',
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ЛАЙК / УБРАТЬ ЛАЙК

app.post('/api/animations/:id/like', authMiddleware, async (req, res) => {
  try {
    const animationId = req.params.id;
    const userId = req.user.id;
    console.log("LIKE USER:", userId);

    const existing = await pool.query(
      `SELECT id FROM animation_likes
       WHERE animation_id = $1 AND user_id = $2`,
      [animationId, userId]
    );

    let liked;

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM animation_likes
         WHERE animation_id = $1 AND user_id = $2`,
        [animationId, userId]
      );

      liked = false;
    } else {
      await pool.query(
        `INSERT INTO animation_likes (animation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (animation_id, user_id) DO NOTHING`,
        [animationId, userId]
      );

      liked = true;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS likes_count
       FROM animation_likes
       WHERE animation_id = $1`,
      [animationId]
    );

    res.json({
      liked,
      likes_count: countResult.rows[0].likes_count
    });

  } catch (err) {
    console.error("LIKE ERROR:", err);
    res.status(500).json({ error: 'Like error' });
  }
});

// ПРОСМОТР

app.post('/api/animations/:id/view', authMiddleware, async (req, res) => {
  try {
    const animationId = req.params.id;
    const userId = req.user.id;
    console.log("VIEW USER:", userId);

    await pool.query(
      `INSERT INTO animation_views (animation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (animation_id, user_id) DO NOTHING`,
      [animationId, userId]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS views_count
       FROM animation_views
       WHERE animation_id = $1`,
      [animationId]
    );

    res.json({
      success: true,
      views_count: countResult.rows[0].views_count
    });

  } catch (err) {
    console.error("VIEW ERROR:", err);
    res.status(500).json({ error: 'View error' });
  }
});

// TELEMETRY EVENTS

app.post(
  '/api/animations/:id/event',
  authMiddleware,
  async (req, res) => {

    try {

      const animationId = req.params.id;

      const userId = req.user.id;

      const {
        event_type,
        video_time,
        playback_rate,
        metadata
      } = req.body;

      await pool.query(
        `
        INSERT INTO animation_events
        (
          animation_id,
          user_id,
          event_type,
          video_time,
          playback_rate,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          animationId,
          userId,
          event_type,
          video_time || null,
          playback_rate || 1,
          metadata || {}
        ]
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.error("EVENT ERROR:", err);

      res.status(500).json({
        error: 'Event error'
      });
    }
  }
);

// ATTENTION ANALYTICS

app.get(
  '/api/animations/:id/attention',
  async (req, res) => {

    try {

      const animationId = req.params.id;

      const result = await pool.query(
        `
        SELECT
          event_type,
          video_time,
          playback_rate
        FROM animation_events
        WHERE animation_id = $1
        ORDER BY created_at ASC
        `,
        [animationId]
      );

      const heatmap = {};

      for (const event of result.rows) {

        if (
          event.video_time === null ||
          event.video_time === undefined
        ) continue;

        const second =
          Math.round(event.video_time);

        if (!heatmap[second]) {
          heatmap[second] = 0;
        }

        switch (event.event_type) {

          case 'pause':
            heatmap[second] += 3;
            break;

          case 'seek':
            heatmap[second] += 5;
            break;

          case 'complete':
            heatmap[second] += 10;
            break;

          case 'speed_change':

            if (event.playback_rate < 1) {
              heatmap[second] += 6;
            }

            if (event.playback_rate > 1) {
              heatmap[second] -= 2;
            }

            break;

          default:
            break;
        }
      }

      const graphData =
        Object.entries(heatmap)
        .map(([second, score]) => ({
          second: Number(second),
          score
        }))

        .sort((a, b) => a.second - b.second);

      res.json(graphData);
      console.log("REAL DATA:", graphData);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: 'Attention analytics error'
      });
    }
  }
);

// PNG ATTENTION ANALYTICS

app.get(
  '/api/animations/:id/png-attention',
  async (req, res) => {

    try {

      const animationId = req.params.id;



      

      const result = await pool.query(
        `
        SELECT
          video_time,
          metadata
        FROM animation_events
        WHERE animation_id = $1
        AND event_type = 'png_frame_view'
        ORDER BY created_at ASC
        `,
        [animationId]
      );

      const heatmap = {};

      for (const event of result.rows) {

        if (
          event.video_time === null ||
          event.video_time === undefined
        ) continue;

        const frame =
          Number(event.metadata?.frame);

        const totalFrames =
          Number(event.metadata?.total_frames) || 1;

        if (isNaN(frame)) continue;

        const normalizedSecond =
          Number(
              (
                  frame / Math.max(1, totalFrames - 1)
              ).toFixed(3)
          );

        if (!heatmap[normalizedSecond]) {
            heatmap[normalizedSecond] = 0;
        }

        heatmap[normalizedSecond] += 1;
      }

      const maxScore =
          Math.max(...Object.values(heatmap), 1);

      const graphData =
          Object.entries(heatmap)
          .map(([second, score]) => ({

              second: Number(second),

              score

          }))
          .sort((a, b) => a.second - b.second);

      

      res.json(graphData);

    } catch (err) {

      console.error("PNG attention error:", err);

      res.status(500).json({
        error: 'PNG attention analytics error'
      });
    }
  }
);


// AI ATTENTION PREDICTION

async function generateAIAttention(animationId,
  frameUrls,
  duration) {
  try {
    if (!frameUrls || frameUrls.length < 2) {
      console.log("Not enough frames for AI analysis");
      return;
    }

    await pool.query(
      `DELETE FROM animation_ai_attention WHERE animation_id = $1`,
      [animationId]
    );

    const step = Math.max(1, Math.floor(frameUrls.length / 60));

    let previousImage = null;

    let previousScore = 0;

    for (let i = 0; i < frameUrls.length; i += step) {
      const response = await fetch(frameUrls[i]);

      const arrayBuffer = await response.arrayBuffer();

      const buffer = Buffer.from(arrayBuffer);

      const image = await Jimp.read(buffer);

      await image.resize({
          w: 64,
          h: 64
      });

      await image.greyscale();

      let score = 0;

      if (previousImage) {
        let diff = 0;

        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            const currentPixel = intToRGBA(
              image.getPixelColor(x, y)
            ).r;

            const previousPixel = intToRGBA(
              previousImage.getPixelColor(x, y)
            ).r;

            diff += Math.abs(currentPixel - previousPixel);
          }
        }

        const maxDiff = 64 * 64 * 255;

        score = Math.min(
          60,
          Math.round((diff / maxDiff) * 100)
        );

        score = previousScore
          ? Math.round((previousScore * 0.7) + (score * 0.3))
          : score;

        previousScore = score;
      }

      const second =
      Math.round((i / frameUrls.length) * duration);

      await pool.query(
        `
        INSERT INTO animation_ai_attention
        (animation_id, second, score)
        VALUES ($1, $2, $3)
        `,
        [animationId, second, score]
      );

      previousImage = image;
    }

    console.log("AI frame attention generated:", animationId);

  } catch (err) {
    console.error("AI attention generation error:");
    console.error(err);
    console.error(err?.stack);
  }
}

app.get('/api/animations/:id/ai-attention',
  async (req, res) => {

    try {

      const result = await pool.query(
        `
        SELECT second, score
        FROM animation_ai_attention
        WHERE animation_id = $1
        ORDER BY second ASC
        `,
        [req.params.id]
      );

      res.json(result.rows);
      console.log("AI DATA:", result.rows);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: 'AI attention error'
      });
    }
  }
);

app.get('/api/analytics/confusion-matrix', authMiddleware, async (req, res) => {
    try {
        // Получаем все анимации
        const animations = await pool.query('SELECT id FROM animations');
        
        let allTP = 0, allFP = 0, allTN = 0, allFN = 0;
        const perAnimation = [];

        for (const anim of animations.rows) {
            const animId = anim.id;

            // Real attention (сырые данные как в /attention)
            const eventsResult = await pool.query(`
                SELECT event_type, video_time, playback_rate
                FROM animation_events
                WHERE animation_id = $1
                ORDER BY created_at ASC
            `, [animId]);

            const heatmap = {};
            for (const event of eventsResult.rows) {
                if (event.video_time === null) continue;
                const second = Math.round(event.video_time);
                if (!heatmap[second]) heatmap[second] = 0;

                switch (event.event_type) {
                    case 'pause':       heatmap[second] += 3; break;
                    case 'seek':        heatmap[second] += 5; break;
                    case 'complete':    heatmap[second] += 10; break;
                    case 'speed_change':
                        if (event.playback_rate < 1) heatmap[second] += 6;
                        if (event.playback_rate > 1) heatmap[second] -= 2;
                        break;
                }
            }

            // AI данные
            const aiResult = await pool.query(`
                SELECT second, score
                FROM animation_ai_attention
                WHERE animation_id = $1
                ORDER BY second ASC
            `, [animId]);

            if (!aiResult.rows.length) continue;

            // Находим общие секунды
            const aiMap = {};
            for (const row of aiResult.rows) {
                aiMap[row.second] = Number(row.score);
            }

            const commonSeconds = Object.keys(aiMap)
                .map(Number)
                .filter(s => heatmap[s] !== undefined);

            if (commonSeconds.length < 2) continue;

            // Нормализуем оба массива к 0-100
            const realValues = commonSeconds.map(s => heatmap[s]);
            const aiValues = commonSeconds.map(s => aiMap[s]);

            const realMax = Math.max(...realValues, 1);
            const aiMax = Math.max(...aiValues, 1);

            const realNorm = realValues.map(v => (v / realMax) * 100);
            const aiNorm = aiValues.map(v => (v / aiMax) * 100);

            // Бинаризация по порогу 50
            const THRESHOLD = 50;

            let tp = 0, fp = 0, tn = 0, fn = 0;

            for (let i = 0; i < commonSeconds.length; i++) {
                const realHigh = realNorm[i] >= THRESHOLD;
                const aiHigh = aiNorm[i] >= THRESHOLD;

                if (realHigh && aiHigh)   tp++;  // истина-истина
                if (!realHigh && aiHigh)  fp++;  // ложь-истина
                if (!realHigh && !aiHigh) tn++;  // ложь-ложь
                if (realHigh && !aiHigh)  fn++;  // истина-ложь
            }

            allTP += tp;
            allFP += fp;
            allTN += tn;
            allFN += fn;

            const total = tp + fp + tn + fn;
            const accuracy  = total ? ((tp + tn) / total * 100).toFixed(2) : 0;
            const precision = (tp + fp) ? (tp / (tp + fp) * 100).toFixed(2) : 0;
            const recall    = (tp + fn) ? (tp / (tp + fn) * 100).toFixed(2) : 0;
            const f1 = (precision + recall > 0)
                ? (2 * precision * recall / (Number(precision) + Number(recall))).toFixed(2)
                : 0;

            perAnimation.push({
                animation_id: animId,
                points_compared: commonSeconds.length,
                tp, fp, tn, fn,
                accuracy, precision, recall, f1
            });
        }

        // Суммарные метрики по всем анимациям
        const total = allTP + allFP + allTN + allFN;
        const accuracy  = total ? ((allTP + allTN) / total * 100).toFixed(2) : 0;
        const precision = (allTP + allFP) ? (allTP / (allTP + allFP) * 100).toFixed(2) : 0;
        const recall    = (allTP + allFN) ? (allTP / (allTP + allFN) * 100).toFixed(2) : 0;
        const f1 = (Number(precision) + Number(recall) > 0)
            ? (2 * Number(precision) * Number(recall) / (Number(precision) + Number(recall))).toFixed(2)
            : 0;

        res.json({
            summary: {
                total_points: total,
                confusion_matrix: {
                    TP: allTP,  // истина-истина
                    FP: allFP,  // ложь-истина
                    TN: allTN,  // ложь-ложь
                    FN: allFN   // истина-ложь
                },
                accuracy:  accuracy  + '%',
                precision: precision + '%',
                recall:    recall    + '%',
                f1_score:  f1
            },
            per_animation: perAnimation
        });

    } catch (err) {
        console.error('Confusion matrix error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});