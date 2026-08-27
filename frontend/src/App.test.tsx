import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("does not consume the login continuation twice", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return jsonResponse({
          user: { id: "1", username: "admin", email: null, role: "admin" },
          redirectTo: "#callback",
        });
      }
      if (url.includes("/api/auth/continue")) return jsonResponse({ redirectTo: "/admin" });
      return jsonResponse({ authenticated: false, csrfToken: "csrf", settings: { signupEnabled: false, adminUiEnabled: true } }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/login?state=continuation-token");

    fireEvent.change(await screen.findByLabelText(/Username/), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(window.location.hash).toBe("#callback"));
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/auth/continue"))).toHaveLength(0);
  });

  it("protects and renders the administrator dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/dashboard")) return jsonResponse({ users: 2, groups: 1, applications: 3, sessions: 1, accessDenied: 4 });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(await screen.findByText("Active sessions")).toBeTruthy();
  });
});
