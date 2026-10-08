import { api } from "@/lib/api";

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

export function getAdminToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getAdminUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAdminAuthenticated() {
  return Boolean(getAdminToken());
}

export function saveAdminSession({ token, accessToken, user }) {
  const authToken = token || accessToken;

  if (!authToken || !user) {
    throw new Error("Login response did not include a valid admin session");
  }

  localStorage.setItem(TOKEN_KEY, authToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function loginAdmin(credentials) {
  const response = await api.post("/auth/login", credentials);
  const session = response.data || response;
  const role = session.user?.role;

  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    clearAdminSession();
    throw new Error("This account is not allowed to access the admin panel");
  }

  saveAdminSession(session);
  return session.user;
}
