// api/counter.ts
import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 加入 CORS 標頭，讓 Hugo 等前端可以跨域呼叫
  res.setHeader('Access-Control-Allow-Origin', '*'); // 生產時可改成你的 Hugo 網域
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 預檢請求（CORS 必要）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 取得查詢參數
  const { slug, action = 'view' } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: '缺少 slug 參數' });
  }

  const safeSlug = slug as string;
  const isLikeAction = action === 'like';

  try {
    // 建立 Neon 連線
    const sql = neon(process.env.DATABASE_URL!);

    // 先取得目前計數（如果不存在則為 0）
    let views = 0;
    let likes = 0;

    const rows = await sql`
      SELECT views, likes 
      FROM article_counters 
      WHERE slug = ${safeSlug}
    `;

    if (rows.length > 0) {
      views = Number(rows[0].views);
      likes = Number(rows[0].likes);
    }

    // 如果是 view 動作（通常是 GET），自動增加閱讀次數
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

    // 如果是 like 動作且是 POST，增加讚數
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

    // 回傳目前計數
    return res.status(200).json({
      slug: safeSlug,
      views,
      likes
    });

  } catch (error: any) {
    console.error('API Error:', error.message, error.stack);
    return res.status(500).json({
      error: '伺服器內部錯誤',
      message: error.message || '未知錯誤'
    });
  }
}