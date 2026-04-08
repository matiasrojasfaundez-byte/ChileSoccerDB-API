export async function api(path) {
  const res = await fetch(path)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'API error')
  }
  return res.json()
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value ?? 0)
}
