import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import { LessThan } from "typeorm";
import type { Config } from "../config.js";
import { ApplicationEntity, LoginStateEntity } from "../database/entities.js";
import { opaqueToken, tokenHash } from "./crypto.js";
import { normalizeHostname } from "../applications/hostnames.js";

export class LoginStateService {
  constructor(private readonly dataSource: DataSource, private readonly config: Config) {}

  async create(returnTo: string): Promise<string> {
    await this.validateDestination(returnTo);
    const repository = this.dataSource.getRepository(LoginStateEntity);
    await repository.delete({ expiresAt: LessThan(new Date()) });
    const token = opaqueToken();
    const now = new Date();
    await repository.insert({
      id: randomUUID(),
      tokenHash: tokenHash(token, this.config.sessionSecret),
      returnTo,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.loginStateTtlMs),
    });
    return token;
  }

  async consume(token: string): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) return null;
    const repository = this.dataSource.getRepository(LoginStateEntity);
    const state = await repository.findOneBy({ tokenHash: tokenHash(token, this.config.sessionSecret) });
    if (!state) return null;
    const deletion = await repository.delete(state.id);
    if (!deletion.affected || state.expiresAt.getTime() <= Date.now()) return null;
    try {
      await this.validateDestination(state.returnTo);
      return state.returnTo;
    } catch {
      return null;
    }
  }

  private async validateDestination(returnTo: string): Promise<void> {
    const parsed = new URL(returnTo);
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) throw new Error("Invalid return destination");
    const application = await this.dataSource.getRepository(ApplicationEntity).findOneBy({ hostname, enabled: true });
    if (!application) throw new Error("Return destination is not an enabled application");
  }
}
