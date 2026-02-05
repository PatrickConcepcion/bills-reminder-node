import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveBillIsActive1770269628000 implements MigrationInterface {
    name = 'RemoveBillIsActive1770269628000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bill\` DROP INDEX \`IDX_4b33993ef90861a10fcf1229d8\``);
        await queryRunner.query(`ALTER TABLE \`bill\` DROP COLUMN \`isActive\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bill\` ADD \`isActive\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`CREATE INDEX \`IDX_4b33993ef90861a10fcf1229d8\` ON \`bill\` (\`userId\`, \`isActive\`)`);
    }
}
