import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');  // 允許 Hugo 跨域 fetch
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug, action = 'view' } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: '缺少 slug' });
  }

  const safeSlug = slug as string;
  const isLikeAction = action === 'like';

  try {
    let views = 0;
    let likes = 0;

    // 取目前值
    const rows = await sql`SELECT views, likes FROM article_counters WHERE slug = ${safeSlug}`;
    if (rows.length > 0) {
      views = rows[0].views;
      likes = rows[0].likes;
    }

    // 如果是 view (GET)，自動 +1 views
    if (!isLikeAction && req.method === 'GET') {
      await sql`
        INSERT INTO article_counters (slug, views, likes)
        VALUES (${safeSlug}, 1, 0)
        ON CONFLICT (slug) DO UPDATE
        SET views = article_counters.views + 1,
            updated_at = CURRENT_TIMESTAMP
      `;
      views += 1;
    }

    // 如果是 like 且 POST，+1 likes
    if (isLikeAction && req.method === 'POST') {
      await sql`
        INSERT INTO article_counters (slug, views, likes)
        VALUES (${safeSlug}, 0, 1)
        ON CONFLICT (slug) DO UPDATE
        SET likes = article_counters.likes + 1,
            updated_at = CURRENT_TIMESTAMP
      `;
      likes += 1;
    }

    return res.status(200).json({ slug: safeSlug, views, likes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}