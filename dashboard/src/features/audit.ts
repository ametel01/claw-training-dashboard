import type { AnyList } from '../core/types'

export function renderAuditLog(rows: AnyList = []): void {
  const node = document.getElementById('auditLogPanel')
  if (!node) return
  if (!rows.length) {
    node.innerHTML = '<p class="muted">No audit events yet.</p>'
    return
  }

  node.innerHTML = `<div class="audit-list">${rows
    .map((row) => {
      const timestamp = (row.event_time || '').replace('T', ' ').slice(0, 19)
      const change =
        row.old_value || row.new_value ? `${row.old_value ?? '∅'} → ${row.new_value ?? '∅'}` : ''
      return `
      <div class="audit-row">
        <div class="audit-top">
          <span>${row.domain} · ${row.action} · ${row.key_name || '-'}</span>
          <span>${timestamp}</span>
        </div>
        ${change ? `<div class="audit-meta">${change}</div>` : ''}
        ${row.note ? `<div class="audit-meta">${row.note}</div>` : ''}
      </div>
    `
    })
    .join('')}</div>`
}
