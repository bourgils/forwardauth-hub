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
      if (url.includes("/api/admin/dashboard")) return jsonResponse({
        users: { total: 2, active: 2, disabled: 0, scheduled: 0, expired: 0, withoutGroup: 1 },
        applications: { total: 3, active: 3, withoutGroupAccess: 1 },
        groups: { total: 1, disabled: 0 },
        sessions: { active: 1, uniqueUsers: 1 },
        security: { accessDenied24h: 4, loginFailures24h: 2 },
        topApplications: [{ id: "app-1", name: "Jellyfin", hostname: "jellyfin.example.com", requests: 12, users: 2, lastAccessAt: new Date().toISOString() }],
        recentSecurity: [],
      });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { appName: "Test Auth", signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(await screen.findByText("Test Auth")).toBeTruthy();
    expect(await screen.findByText("Active sessions")).toBeTruthy();
    expect((await screen.findByRole("link", { name: /Active users/ })).getAttribute("href")).toBe("/admin/users");
    expect(screen.getByRole("link", { name: "Add user" }).getAttribute("href")).toBe("/admin/users?open=true&action=create");
    expect(screen.getByRole("link", { name: "Add group" }).getAttribute("href")).toBe("/admin/groups?open=true&action=create");
    expect(screen.getByRole("link", { name: "Add application" }).getAttribute("href")).toBe("/admin/applications?open=true&action=create");
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const search = await screen.findByRole("textbox", { name: "Search application sections" });
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(screen.getByText("Quick access")).toBeTruthy();
    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search application sections" })).toBeNull());
    expect(screen.getByRole("button", { name: "Applications" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.queryByRole("menuitem", { name: "Applications" })).toBeNull();
  });

  it("opens group creation from the URL and continues with assignments", async () => {
    const createdGroup = { id: "group-1", name: "Operators", description: null, enabled: true, userIds: [], applicationIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    let created = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const method = init?.method ?? "GET";
      if (path === "/api/admin/groups" && method === "POST") { created = true; return jsonResponse(createdGroup, 201); }
      if (path === "/api/admin/groups") return jsonResponse({ items: created ? [createdGroup] : [] });
      if (path === "/api/admin/users" || path === "/api/admin/applications") return jsonResponse({ items: [] });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { appName: "Test Auth", signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));

    renderApp("/admin/groups?open=true&action=create");
    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: "Operators" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Assignments · Operators" })).toBeTruthy();
  });

  it("continues user creation with group assignments available from row actions", async () => {
    const createdUser = { id: "user-1", username: "alice", email: null, role: "user", enabled: true, accessStartsAt: null, accessEndsAt: null, groupIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const group = { id: "group-1", name: "Developers", description: null, enabled: true, userIds: [], applicationIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    let created = false;
    let createPayload: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const method = init?.method ?? "GET";
      if (path === "/api/admin/users" && method === "POST") {
        created = true;
        createPayload = JSON.parse(String(init?.body));
        return jsonResponse(createdUser, 201);
      }
      if (path === "/api/admin/users") return jsonResponse({ items: created ? [createdUser] : [] });
      if (path === "/api/admin/groups") return jsonResponse({ items: [group] });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { appName: "Test Auth", signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));

    renderApp("/admin/users?open=true&action=create");
    fireEvent.change(await screen.findByLabelText(/Username/), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "longpassword1" } });
    expect(screen.queryByLabelText("Groups")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Assignments · alice" })).toBeTruthy();
    expect(createPayload).not.toHaveProperty("groupIds");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Actions for alice" }));
    expect(await screen.findByRole("menuitem", { name: "Assignments" })).toBeTruthy();
  });

  it("opens application creation from the URL and continues with permissions", async () => {
    const createdApplication = { id: "app-1", name: "Jellyfin", hostname: "jellyfin.example.com", enabled: true, groupIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    let created = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const method = init?.method ?? "GET";
      if (path === "/api/admin/applications" && method === "POST") { created = true; return jsonResponse(createdApplication, 201); }
      if (path === "/api/admin/applications") return jsonResponse({ items: created ? [createdApplication] : [] });
      if (path === "/api/admin/applications/app-1/groups") return jsonResponse({ items: [] });
      return jsonResponse({ authenticated: true, csrfToken: "csrf", settings: { appName: "Test Auth", signupEnabled: false, adminUiEnabled: true }, user: { id: "1", username: "admin", email: null, role: "admin" } });
    }));

    renderApp("/admin/applications?open=true&action=create");
    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: "Jellyfin" } });
    fireEvent.change(screen.getByLabelText(/Hostname/), { target: { value: "jellyfin.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Permissions · Jellyfin" })).toBeTruthy();
  });
});
