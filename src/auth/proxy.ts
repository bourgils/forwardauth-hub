import type { Request } from "express";
import proxyaddr from "proxy-addr";
import type { Config } from "../config.js";
import { forwardedHostname } from "../applications/hostnames.js";

export interface ForwardedRequest {
  hostname: string;
  uri: string;
  protocol: "http" | "https";
  method: string;
  isWebSocket: boolean;
  wantsHtml: boolean;
  returnTo: string;
}

export function trustedProxy(config: Config): (req: Request) => boolean {
  const trust = proxyaddr.compile(config.trustedProxies);
  return (req) => trust(req.socket.remoteAddress ?? "", 0);
}

function firstHeader(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim();
}

export function readForwardedRequest(req: Request, config: Config): ForwardedRequest | null {
  if (!trustedProxy(config)(req)) return null;
  const hostname = forwardedHostname(req.get("x-forwarded-host"));
  const protocol = firstHeader(req.get("x-forwarded-proto"));
  const uri = req.get("x-forwarded-uri") ?? "/";
  const method = (req.get("x-forwarded-method") ?? "GET").toUpperCase();
  if (!hostname || (protocol !== "http" && protocol !== "https") || !uri.startsWith("/") || uri.startsWith("//")) return null;

  const upgrade = req.get("upgrade")?.toLowerCase();
  const connection = req.get("connection")?.toLowerCase() ?? "";
  const isWebSocket = upgrade === "websocket" || connection.split(",").map((part) => part.trim()).includes("upgrade");
  const wantsHtml = !isWebSocket && (method === "GET" || method === "HEAD") && (req.get("accept") ?? "").toLowerCase().includes("text/html");

  return {
    hostname,
    uri,
    protocol,
    method,
    isWebSocket,
    wantsHtml,
    returnTo: `${protocol}://${hostname}${uri}`,
  };
}

export function authBaseUrl(req: Request, config: Config): string {
  if (config.publicUrl) return config.publicUrl;
  if (trustedProxy(config)(req)) {
    const explicit = req.get("x-forwarded-auth-url");
    if (explicit) {
      const parsed = new URL(explicit);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.origin;
    }
  }
  const protocol = trustedProxy(config)(req) ? firstHeader(req.get("x-forwarded-proto")) ?? req.protocol : req.protocol;
  return `${protocol}://${req.get("host")}`;
}
