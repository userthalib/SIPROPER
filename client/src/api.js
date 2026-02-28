export function getToken() {
  return localStorage.getItem('siproper_token') || ''
}

export function setToken(t) {
  if (!t) localStorage.removeItem('siproper_token')
  else localStorage.setItem('siproper_token', t)
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const tok = token ?? getToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),
  listRecords: (params = {}) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue
      q.set(k, String(v))
    }
    const qs = q.toString()
    return request('/api/records' + (qs ? `?${qs}` : ''))
  },
  patchRecord: (id, patch, version) => request(`/api/records/${id}`, { method: 'PATCH', body: { patch, version } }),
  listUsers: () => request('/api/users'),
  createUser: (username, password, role) => request('/api/users', { method: 'POST', body: { username, password, role } })
}

export async function importExcel(file) {
  const tok = getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/import/excel', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok}`
    },
    body: form
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
