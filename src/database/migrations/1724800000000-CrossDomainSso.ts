import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class CrossDomainSso1724800000000 implements MigrationInterface {
  name = "CrossDomainSso1724800000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateType = queryRunner.connection.options.type === "postgres" ? "timestamptz" : "datetime";

    await queryRunner.addColumns("sessions", [
      new TableColumn({ name: "application_id", type: "varchar", length: "36", isNullable: true }),
      new TableColumn({ name: "parent_session_id", type: "varchar", length: "36", isNullable: true }),
    ]);
    await queryRunner.createForeignKeys("sessions", [
      new TableForeignKey({ name: "fk_sessions_application", columnNames: ["application_id"], referencedTableName: "applications", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
      new TableForeignKey({ name: "fk_sessions_parent", columnNames: ["parent_session_id"], referencedTableName: "sessions", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
    ]);
    await queryRunner.createIndices("sessions", [
      new TableIndex({ name: "idx_sessions_application_id", columnNames: ["application_id"] }),
      new TableIndex({ name: "idx_sessions_parent_session_id", columnNames: ["parent_session_id"] }),
    ]);

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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("authorization_codes", true);
    await queryRunner.dropIndex("sessions", "idx_sessions_parent_session_id");
    await queryRunner.dropIndex("sessions", "idx_sessions_application_id");
    await queryRunner.dropForeignKey("sessions", "fk_sessions_parent");
    await queryRunner.dropForeignKey("sessions", "fk_sessions_application");
    await queryRunner.dropColumn("sessions", "parent_session_id");
    await queryRunner.dropColumn("sessions", "application_id");
  }
}
