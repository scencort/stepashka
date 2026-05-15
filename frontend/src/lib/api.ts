// реэкспорт из основного api-модуля
// держим здесь чтобы можно было импортировать из "../lib/api" вместо "../services/api"
export { api, getAccessToken, getRefreshToken, API_BASE_URL, clearTokens } from "../services/api"
