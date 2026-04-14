/**
 * GET /api/library — full state
 * PUT /api/library — replace full state (prompts + notes)
 */

const BATCH_SIZE = 100;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) {
    return errorResponse('D1 binding missing (configure DB in Pages project)', 500);
  }
  try {
    const promptsRes = await env.DB.prepare(
      'SELECT id, title, content, metadata, user_rating FROM prompts'
    ).all();
    const rows = promptsRes.results || [];
    const prompts = rows.map((row) => {
      let metadata;
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        metadata = {};
      }
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        metadata,
        userRating: row.user_rating != null ? Number(row.user_rating) : null
      };
    });
    prompts.sort(
      (a, b) =>
        new Date(b.metadata?.createdAt || 0) - new Date(a.metadata?.createdAt || 0)
    );

    const notesRes = await env.DB.prepare(
      'SELECT id, prompt_id, content, created_at, updated_at FROM notes'
    ).all();
    const noteRows = notesRes.results || [];
    const notes = {};
    for (const row of noteRows) {
      const pid = row.prompt_id;
      if (!notes[pid]) notes[pid] = [];
      notes[pid].push({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
    for (const pid of Object.keys(notes)) {
      notes[pid].sort((a, b) => b.createdAt - a.createdAt);
    }

    return jsonResponse({ prompts, notes });
  } catch (e) {
    console.error('GET /api/library', e);
    return errorResponse(e.message || 'Database error', 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  if (!env.DB) {
    return errorResponse('D1 binding missing (configure DB in Pages project)', 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object') {
    return errorResponse('Body must be an object', 400);
  }
  const prompts = body.prompts;
  const notes = body.notes;
  if (!Array.isArray(prompts)) {
    return errorResponse('prompts must be an array', 400);
  }
  if (notes != null && typeof notes !== 'object') {
    return errorResponse('notes must be an object', 400);
  }

  for (const p of prompts) {
    if (!p || typeof p.id !== 'string' || typeof p.title !== 'string' || typeof p.content !== 'string') {
      return errorResponse('Invalid prompt in array', 400);
    }
    if (!p.metadata || typeof p.metadata !== 'object') {
      return errorResponse('Each prompt needs metadata object', 400);
    }
  }

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM notes'),
      env.DB.prepare('DELETE FROM prompts')
    ]);

    const insertPrompts = [];
    for (const p of prompts) {
      insertPrompts.push(
        env.DB.prepare(
          'INSERT INTO prompts (id, title, content, metadata, user_rating) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          p.id,
          p.title,
          p.content,
          JSON.stringify(p.metadata),
          p.userRating != null && p.userRating !== '' ? Number(p.userRating) : null
        )
      );
    }
    for (let i = 0; i < insertPrompts.length; i += BATCH_SIZE) {
      await env.DB.batch(insertPrompts.slice(i, i + BATCH_SIZE));
    }

    const insertNotes = [];
    for (const [promptId, arr] of Object.entries(notes || {})) {
      if (!Array.isArray(arr)) continue;
      for (const n of arr) {
        if (!n || typeof n.id !== 'string' || typeof n.content !== 'string') continue;
        insertNotes.push(
          env.DB.prepare(
            'INSERT INTO notes (id, prompt_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            n.id,
            promptId,
            n.content,
            Number(n.createdAt) || 0,
            Number(n.updatedAt) || 0
          )
        );
      }
    }
    for (let i = 0; i < insertNotes.length; i += BATCH_SIZE) {
      await env.DB.batch(insertNotes.slice(i, i + BATCH_SIZE));
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('PUT /api/library', e);
    return errorResponse(e.message || 'Database error', 500);
  }
}
