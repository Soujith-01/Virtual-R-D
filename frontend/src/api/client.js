import axios from 'axios'

/**
 * Central API service. Every backend call in the app goes through here so that
 * base URL handling, timeouts and error normalisation live in one place.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const client = axios.create({
  baseURL: API_BASE,
  timeout: 180_000,
  headers: { 'Content-Type': 'application/json' },
})

const TOKEN_KEY = 'nucleus_token'

export function setAuthToken(token) {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearAuthToken() {
  setAuthToken(null)
}

client.interceptors.request.use((config) => {
  const token = getStoredAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Turn any axios failure into a message a researcher can act on. */
function toFriendlyMessage(error) {
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out. The agent may still be computing - try again.'
  }

  const response = error?.response
  if (!response) {
    return `Cannot reach the backend at ${API_BASE}. Start it with "python -m uvicorn main:app --reload" from the backend folder.`
  }

  const detail = response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => `${(item.loc || []).slice(1).join('.') || 'body'}: ${item.msg}`)
      .join(' · ')
  }
  if (response.status === 503) {
    return 'The prediction model is not trained yet. Run: python training/generate_dataset.py && python training/train_model.py'
  }
  return `Request failed with status ${response.status}.`
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    error.friendlyMessage = toFriendlyMessage(error)
    return Promise.reject(error)
  },
)

const unwrap = (promise) => promise.then((response) => response.data)

/* ------------------------------- endpoints ------------------------------- */

export const getHealth = () => unwrap(client.get('/health'))
export const getDesignSpace = () => unwrap(client.get('/design-space'))
export const getModelInfo = () => unwrap(client.get('/model-info'))
export const getModelStatus = () => unwrap(client.get('/models/status'))

export const predict = (payload) => unwrap(client.post('/predict', payload))
export const generateExperiments = (payload) => unwrap(client.post('/generate-experiments', payload))
export const simulate = (payload) => unwrap(client.post('/simulate', { ...payload, domain: payload.domain || 'reaction_yield' }))
export const runResearch = (payload) => unwrap(client.post('/research', payload))

export const searchKnowledge = (query, k = 4) =>
  unwrap(client.get('/knowledge/search', { params: { q: query, k } }))

export const getHistory = (limit = 12) => unwrap(client.get('/history', { params: { limit } }))
export const getRun = (runId) => unwrap(client.get(`/history/${runId}`))

export const searchPapers = (query, limit = 10, domain = null) =>
  unwrap(client.get('/papers/search', { params: { query, limit, domain } }))

export const summarizePaper = (paper, researchObjective = null) =>
  unwrap(
    client.post('/papers/summarize', {
      paper_id: paper.paper_id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      venue: paper.venue,
      abstract: paper.abstract,
      doi: paper.doi,
      url: paper.url,
      research_objective: researchObjective,
    }),
  )

export const getLibraryPapers = () => unwrap(client.get('/papers/library'))

export const saveLibraryPaper = (paper) => unwrap(client.post('/papers/library', paper))

export const deleteLibraryPaper = (paperId) => unwrap(client.delete(`/papers/library/${paperId}`))

/* --------------------------------- auth ---------------------------------- */

export const registerUser = (payload) => unwrap(client.post('/api/auth/register', payload))
export const loginUser = (payload) => unwrap(client.post('/api/auth/login', payload))
export const getCurrentUser = () => unwrap(client.get('/api/auth/me'))
export const logoutUser = () => unwrap(client.post('/api/auth/logout'))

/* -------------------------------- admin ---------------------------------- */

export const getAdminUsers = (params = {}) => unwrap(client.get('/api/admin/users', { params }))
export const approveUser = (userId) => unwrap(client.post(`/api/admin/users/${userId}/approve`))
export const rejectUser = (userId) => unwrap(client.post(`/api/admin/users/${userId}/reject`))
export const suspendUser = (userId) => unwrap(client.post(`/api/admin/users/${userId}/suspend`))
export const reactivateUser = (userId) => unwrap(client.post(`/api/admin/users/${userId}/reactivate`))
export const deleteUser = (userId) => unwrap(client.delete(`/api/admin/users/${userId}`))

/* ------------------------------- copilot --------------------------------- */

export const sendExperimentChatMessage = ({ question, context = {}, history = [] }) =>
  unwrap(client.post('/api/experiment-chat', { question, context, history }))

export default client
