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
        { name: "access_starts_at", type: dateType, isNullable: true },
        { name: "access_ends_at", type: dateType, isNullable: true },
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
      name: "groups",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "name", type: "varchar", length: "100", isUnique: true },
        { name: "description", type: "varchar", length: "500", isNullable: true },
        { name: "enabled", type: "boolean", default: true },
        { name: "created_at", type: dateType },
        { name: "updated_at", type: dateType },
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "user_groups",
      columns: [
        { name: "user_id", type: "varchar", length: "36", isPrimary: true },
        { name: "group_id", type: "varchar", length: "36", isPrimary: true },
      ],
      foreignKeys: [
        new TableForeignKey({ name: "fk_user_groups_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_user_groups_group", columnNames: ["group_id"], referencedTableName: "groups", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
      indices: [new TableIndex({ name: "idx_user_groups_group_id", columnNames: ["group_id"] })],
    }));

    await queryRunner.createTable(new Table({
      name: "group_application_access",
      columns: [
        { name: "group_id", type: "varchar", length: "36", isPrimary: true },
        { name: "application_id", type: "varchar", length: "36", isPrimary: true },
      ],
      foreignKeys: [
        new TableForeignKey({ name: "fk_group_application_access_group", columnNames: ["group_id"], referencedTableName: "groups", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_group_application_access_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
      indices: [new TableIndex({ name: "idx_group_application_access_application_id", columnNames: ["application_id"] })],
    }));

    await queryRunner.createTable(new Table({
      name: "sessions",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "user_id", type: "varchar", length: "36" },
        { name: "application_id", type: "varchar", length: "36", isNullable: true },
        { name: "parent_session_id", type: "varchar", length: "36", isNullable: true },
        { name: "token_hash", type: "varchar", length: "64", isUnique: true },
        { name: "created_at", type: dateType },
        { name: "expires_at", type: dateType },
        { name: "last_seen_at", type: dateType },
        { name: "ip", type: "varchar", length: "64", isNullable: true },
        { name: "user_agent", type: "varchar", length: "512", isNullable: true },
      ],
      foreignKeys: [
        new TableForeignKey({ name: "fk_sessions_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_sessions_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_sessions_parent", columnNames: ["parent_session_id"], referencedTableName: "sessions", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
      indices: [
        new TableIndex({ name: "idx_sessions_user_id", columnNames: ["user_id"] }),
        new TableIndex({ name: "idx_sessions_application_id", columnNames: ["application_id"] }),
        new TableIndex({ name: "idx_sessions_parent_session_id", columnNames: ["parent_session_id"] }),
        new TableIndex({ name: "idx_sessions_expires_at", columnNames: ["expires_at"] }),
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "authorization_codes",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "token_hash", type: "varchar", length: "64", isUnique: true },
        { name: "central_session_id", type: "varchar", length: "36" },
        { name: "application_id", type: "varchar", length: "36" },
        { name: "return_to", type: "varchar", length: "2048" },
        { name: "created_at", type: dateType },
        { name: "expires_at", type: dateType },
        { name: "consumed_at", type: dateType, isNullable: true },
      ],
      foreignKeys: [
        new TableForeignKey({ name: "fk_authorization_codes_session", columnNames: ["central_session_id"], referencedTableName: "sessions", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_authorization_codes_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
      indices: [
        new TableIndex({ name: "idx_authorization_codes_expires_at", columnNames: ["expires_at"] }),
        new TableIndex({ name: "idx_authorization_codes_session", columnNames: ["central_session_id"] }),
        new TableIndex({ name: "idx_authorization_codes_application", columnNames: ["application_id"] }),
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "login_states",
      columns: [
        { name: "id", type: "varchar", length: "36", isPrimary: true },
        { name: "token_hash", type: "varchar", length: "64", isUnique: true },
        { name: "return_to", type: "varchar", length: "2048" },
        { name: "created_at", type: dateType },
        { name: "expires_at", type: dateType },
      ],
      indices: [new TableIndex({ name: "idx_login_states_expires_at", columnNames: ["expires_at"] })],
    }));

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
        new TableForeignKey({ name: "fk_audit_logs_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "SET NULL" }),
        new TableForeignKey({ name: "fk_audit_logs_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "SET NULL" }),
      ],
      indices: [
        new TableIndex({ name: "idx_audit_logs_created_at", columnNames: ["created_at"] }),
        new TableIndex({ name: "idx_audit_logs_user_id", columnNames: ["user_id"] }),
        new TableIndex({ name: "idx_audit_logs_application_id", columnNames: ["application_id"] }),
      ],
    }));

    await queryRunner.createTable(new Table({
      name: "user_application_activity",
      columns: [
        { name: "user_id", type: "varchar", length: "36", isPrimary: true },
        { name: "application_id", type: "varchar", length: "36", isPrimary: true },
        { name: "first_access_at", type: dateType },
        { name: "last_access_at", type: dateType },
        { name: "access_count", type: "integer", default: 0 },
        { name: "last_ip", type: "varchar", length: "64", isNullable: true },
      ],
      foreignKeys: [
        new TableForeignKey({ name: "fk_user_application_activity_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        new TableForeignKey({ name: "fk_user_application_activity_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      ],
      indices: [
        new TableIndex({ name: "idx_user_application_activity_last_access_at", columnNames: ["last_access_at"] }),
        new TableIndex({ name: "idx_user_application_activity_application_id", columnNames: ["application_id"] }),
      ],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "user_application_activity",
      "audit_logs",
      "login_states",
      "authorization_codes",
      "sessions",
      "group_application_access",
      "user_groups",
      "groups",
      "applications",
      "users",
    ]) {
      await queryRunner.dropTable(table, true);
    }
  }
}
