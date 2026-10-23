import { query } from "@/lib/db";

// Saved assignments for "Моите задачи". Every query is scoped to the teacher,
// so a teacher can only ever see or change their own assignments.

const LIST_COLUMNS = `id, title, context, score_before, score_after, (final IS NOT NULL) AS has_final, created_at, updated_at`;

export async function saveAnalysis(session, { analysis, context }) {
  const title = String(analysis.title || analysis.parts?.[0]?.label || "Материал").slice(0, 160);
  const rows = await query(
    `INSERT INTO assignments (teacher_id, school_id, title, context, analysis, score_before)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6) RETURNING id`,
    [session.teacherId, session.schoolId, title, JSON.stringify(context || {}), JSON.stringify(analysis), analysis.ai_score_before ?? null]
  );
  return rows[0].id;
}

export async function getAssignment(session, id) {
  const rows = await query("SELECT * FROM assignments WHERE id = $1 AND teacher_id = $2", [id, session.teacherId]);
  return rows[0] || null;
}

export async function saveFinal(session, id, { selected, final }) {
  await query(
    `UPDATE assignments
        SET selected = $1::jsonb, final = $2::jsonb, score_after = $3, updated_at = now()
      WHERE id = $4 AND teacher_id = $5`,
    [JSON.stringify(selected), JSON.stringify(final), final.ai_score_after ?? null, id, session.teacherId]
  );
}

export async function listAssignments(session) {
  return query(`SELECT ${LIST_COLUMNS} FROM assignments WHERE teacher_id = $1 ORDER BY updated_at DESC LIMIT 200`, [session.teacherId]);
}

export async function deleteAssignment(session, id) {
  const rows = await query("DELETE FROM assignments WHERE id = $1 AND teacher_id = $2 RETURNING id", [id, session.teacherId]);
  return rows.length > 0;
}

// A material has one title, chosen at analysis time and renameable by the teacher.
export const cleanTitle = (t = "") => String(t).trim().replace(/\s+/g, " ").slice(0, 160);

export async function renameAssignment(session, id, title) {
  const rows = await query("UPDATE assignments SET title = $1, updated_at = now() WHERE id = $2 AND teacher_id = $3 RETURNING title", [
    title,
    id,
    session.teacherId,
  ]);
  return rows[0]?.title ?? null;
}
