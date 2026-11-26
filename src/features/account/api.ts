export interface AccountResponse {
  ok: boolean
  status: number
  data: { error?: string; [key: string]: unknown }
}

export async function accountRequest(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<AccountResponse> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } }
  }
}
