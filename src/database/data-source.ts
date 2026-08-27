import fs from "node:fs";
import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";
import type { Config } from "../config.js";
import { entities } from "./entities.js";
import { InitialSchema1724700000000 } from "./migrations/1724700000000-InitialSchema.js";
import { CrossDomainSso1724800000000 } from "./migrations/1724800000000-CrossDomainSso.js";

function sqlitePath(databaseUrl: string): string {
  const value = databaseUrl.slice("sqlite:".length);
  if (!value) throw new Error("DATABASE_URL must include a SQLite file path");
  return value;
}

export function createDataSource(config: Config): DataSource {
  let options: DataSourceOptions;

  if (config.databaseUrl.startsWith("sqlite:")) {
    const database = sqlitePath(config.databaseUrl);
    if (database !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(database)), { recursive: true });
    options = {
      type: "better-sqlite3",
      database,
      enableWAL: true,
      entities,
      migrations: [InitialSchema1724700000000, CrossDomainSso1724800000000],
      migrationsRun: true,
      synchronize: false,
    };
  } else if (config.databaseUrl.startsWith("postgresql:") || config.databaseUrl.startsWith("postgres:")) {
    options = {
      type: "postgres",
      url: config.databaseUrl,
      entities,
      migrations: [InitialSchema1724700000000, CrossDomainSso1724800000000],
      migrationsRun: true,
      synchronize: false,
    };
  } else {
    throw new Error("DATABASE_URL must use sqlite:, postgres:, or postgresql:");
  }

  return new DataSource(options);
}
