const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ISO_DATE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/

function parseIsoDate(iso) {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`Expected YYYY-MM or YYYY-MM-DD, got ${JSON.stringify(iso)}`)
  const [, year, month, day] = match
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month in ${iso}`)
  if (day !== undefined) {
    const daysInMonth = new Date(Date.UTC(Number(year), monthIndex + 1, 0)).getUTCDate()
    if (Number(day) < 1 || Number(day) > daysInMonth) throw new Error(`Invalid day in ${iso}`)
  }
  return { year, monthName: MONTHS[monthIndex], day: day === undefined ? undefined : Number(day) }
}

export function formatDate(iso) {
  const { year, monthName, day } = parseIsoDate(iso)
  return day === undefined ? `${monthName} ${year}` : `${day} ${monthName}, ${year}`
}

export function compareIsoDates(a, b) {
  parseIsoDate(a)
  parseIsoDate(b)
  return a < b ? -1 : a > b ? 1 : 0
}
