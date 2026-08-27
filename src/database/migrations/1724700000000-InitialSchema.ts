import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class InitialSchema1724700000000 implements MigrationInterface {
  name = "InitialSchema1724700000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateType = queryRunner.connection.options.type === "postgres" ? "timestamptz" : "datetime";

    await queryRunner.createTable(new Table({
      name: "users",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "username", type: "varchar", length: "64", isUnique: true },
        { name: "email", type: "varchar", length: "320", isNullable: true },
        { name: "password_hash", type: "varchar", length: "255" },
        { name: "role", type: "varchar", length: "16" },
        { name: "enabled", type: "boolean", default: true },
        { name: "created_at", type: dateType },
        { name: "updated_at", type: dateType },
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "applications",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "name", type: "varchar", length: "100" },
        { name: "hostname", type: "varchar", length: "253", isUnique: true },
        { name: "enabled", type: "boolean", default: true },
        { name: "created_at", type: dateType },
        { name: "updated_at", type: dateType },
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "user_application_access",
      columns: [
        { name: "user_id", type: "varchar", length: "36", isPrimary: true },
        { name: "application_id", type: "varchar", length: "36", isPrimary: true },
        { name: "allowed", type: "boolean", default: false },
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "sessions",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "user_id", type: "varchar", length: "36" },
        { name: "token_hash", type: "varchar", length: "64", isUnique: true },
        { name: "created_at", type: dateType },
        { name: "expires_at", type: dateType },
        { name: "last_seen_at", type: dateType },
        { name: "ip", type: "varchar", length: "64", isNullable: true },
        { name: "user_agent", type: "varchar", length: "512", isNullable: true },
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
    }));
    await queryRunner.createIndices("sessions", [
      new TableIndex({ name: "idx_sessions_user_id", columnNames: ["user_id"] }),
      new TableIndex({ name: "idx_sessions_expires_at", columnNames: ["expires_at"] }),
    ]);

    await queryRunner.createTable(new Table({
      name: "login_states",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "token_hash", type: "varchar", length: "64", isUnique: true },
        { name: "return_to", type: "varchar", length: "2048" },
        { name: "created_at", type: dateType },
        { name: "expires_at", type: dateType },
      ],
    }));
    await queryRunner.createIndex("login_states", new TableIndex({ name: "idx_login_states_expires_at", columnNames: ["expires_at"] }));

    await queryRunner.createTable(new Table({
      name: "audit_logs",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "user_id", type: "varchar", length: "36", isNullable: true },
        { name: "action", type: "varchar", length: "64" },
        { name: "application_id", type: "varchar", length: "36", isNullable: true },
        { name: "ip", type: "varchar", length: "64", isNullable: true },
        { name: "metadata", type: "text", isNullable: true },
        { name: "created_at", type: dateType },
      ],
      foreignKeys: [
        new TableForeignKey({ columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "SET NULL" }),
        new TableForeignKey({ columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "SET NULL" }),
      ],
    }));
    await queryRunner.createIndices("audit_logs", [
      new TableIndex({ name: "idx_audit_logs_created_at", columnNames: ["created_at"] }),
      new TableIndex({ name: "idx_audit_logs_user_id", columnNames: ["user_id"] }),
      new TableIndex({ name: "idx_audit_logs_application_id", columnNames: ["application_id"] }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["audit_logs", "login_states", "sessions", "user_application_access", "applications", "users"]) {
      await queryRunner.dropTable(table, true);
    }
  }
}
