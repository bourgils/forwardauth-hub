import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { theme } from "./theme";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderApp(path: string) {
  return render(<ThemeProvider theme={theme}><CssBaseline /><MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter></ThemeProvider>);
}

afterEach(() => cleanup());

describe("React application", () => {
  it("renders the login page and public signup option", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ authenticated: false, csrfToken: "csrf", settings: { signupEnabled: true, adminUiEnabled: true } }, 401)));
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
  });

  it("renders an expired authorization error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ authenticated: false, csrfToken: "csrf", settings: { signupEnabled: false, adminUiEnabled: true } }, 401)));
    renderApp("/auth/error?reason=invalid_authorization_code");
    expect(await screen.findByRole("heading", { name: "Authorization failed" })).toBeTruthy();
    expect(screen.getByText(/expired or has already been used/)).toBeTruthy();
  });

  it("protects and renders the administrator dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/dashboard")) return jsonResponse({ users: 2, applications: 3, sessions: 1, accessDenied: 4 });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(await screen.findByText("Active sessions")).toBeTruthy();
  });
});
