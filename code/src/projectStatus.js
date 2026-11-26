export const STATUS_LABELS = {
  'in-progress': 'In progress',
  complete: 'Complete',
  archived: 'Archived',
}

export const STATUSES = Object.keys(STATUS_LABELS)

export function statusLabel(status) {
  const label = STATUS_LABELS[status]
  if (label === undefined) throw new Error(`Unknown project status: ${JSON.stringify(status)}`)
  return label
}
