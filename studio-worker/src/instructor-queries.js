export const LIST_INSTRUCTOR_CLASSES_SQL = `SELECT c.id, c.slug, c.name, c.status, c.created_at,
  COUNT(DISTINCT CASE WHEN cm.role = 'student' AND lower(u.email) NOT LIKE '%@example.com' THEN cm.user_id END) AS student_count,
  COUNT(DISTINCT rv.id) AS report_count,
  COUNT(DISTINCT dv.id) AS module2_version_count
 FROM classes c
 LEFT JOIN class_memberships cm ON cm.class_id = c.id
 LEFT JOIN users u ON u.id = cm.user_id
 LEFT JOIN report_versions rv ON rv.class_id = c.id AND rv.user_id = cm.user_id
   AND cm.role = 'student' AND lower(u.email) NOT LIKE '%@example.com'
 LEFT JOIN deliverable_versions dv ON dv.class_id = c.id AND dv.user_id = cm.user_id
   AND dv.module_key = ? AND cm.role = 'student' AND lower(u.email) NOT LIKE '%@example.com'
 WHERE c.id = ?
 GROUP BY c.id
 ORDER BY c.created_at DESC`;

export const LIST_CLASS_STUDENTS_SQL = `SELECT u.id, u.email, u.name,
  cm.id AS membership_id, cm.status, cm.model_access_status,
  cm.usage_used_micros, cm.usage_limit_micros, cm.created_at,
  w.id AS workspace_id, w.current_step, w.updated_at AS workspace_updated_at,
  m2.current_step AS module2_current_step, m2.status AS module2_status,
  m2.updated_at AS module2_updated_at,
  COUNT(DISTINCT rv.id) AS report_count,
  COUNT(DISTINCT dv.id) AS module2_version_count,
  MAX(rv.created_at) AS latest_report_at,
  MAX(dv.created_at) AS latest_module2_version_at,
  MAX(lr.created_at) AS latest_llm_at
 FROM class_memberships cm
 JOIN users u ON u.id = cm.user_id
 LEFT JOIN class_workspaces cw ON cw.user_id = u.id AND cw.class_id = cm.class_id
 LEFT JOIN workspaces w ON w.id = cw.workspace_id AND w.engagement_id = ?
 LEFT JOIN workspace_module_states m2 ON m2.workspace_id = w.id AND m2.module_key = 'module_2'
 LEFT JOIN report_versions rv ON rv.user_id = u.id AND rv.class_id = cm.class_id
 LEFT JOIN deliverable_versions dv ON dv.user_id = u.id AND dv.class_id = cm.class_id AND dv.module_key = 'module_2'
 LEFT JOIN llm_runs lr ON lr.user_id = u.id
   AND (
     lr.class_membership_id = cm.id
     OR (
       lr.class_membership_id IS NULL
       AND 1 = (
         SELECT COUNT(*) FROM class_memberships cm_single
         WHERE cm_single.user_id = u.id
       )
     )
   )
 WHERE cm.class_id = ? AND cm.role = 'student'
   AND lower(u.email) NOT LIKE '%@example.com'
 GROUP BY u.id, cm.id, w.id
 ORDER BY u.name COLLATE NOCASE`;

export const INSTRUCTOR_PROMPTS_SQL = `SELECT lr.id, lr.workspace_id, lr.module, lr.workflow_key,
  lr.system_prompt, lr.module_prompt, lr.request_json, lr.response_json, lr.provider, lr.model,
  lr.input_tokens, lr.output_tokens, lr.estimated_cost_micros, lr.guardrail_status, lr.created_at
 FROM llm_runs lr
 WHERE lr.user_id = ?
   AND lr.workflow_key = ?
   AND (
     lr.class_membership_id IN (
       SELECT id FROM class_memberships WHERE user_id = ? AND class_id = ?
     )
     OR (
       lr.class_membership_id IS NULL
       AND 1 = (
         SELECT COUNT(*) FROM class_memberships cm_single
         WHERE cm_single.user_id = lr.user_id
       )
       AND EXISTS (
         SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?
       )
     )
   )
 ORDER BY lr.created_at DESC
 LIMIT 200`;

export function isActiveAdminMembership(membership) {
  return Boolean(
    membership
    && membership.role === 'admin'
    && membership.status === 'active'
    && membership.class_status === 'active'
    && membership.class_code_status === 'active'
  );
}
