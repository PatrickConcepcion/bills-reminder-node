import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBills1770251472122 implements MigrationInterface {
    name = 'CreateBills1770251472122'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`bill\` (\`id\` varchar(36) NOT NULL, \`userId\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`amount\` decimal(10,2) NULL, \`currency\` varchar(8) NULL, \`description\` text NULL, \`isRecurring\` tinyint NOT NULL, \`frequency\` enum ('MONTHLY', 'WEEKLY', 'YEARLY') NULL, \`dueDate\` datetime NOT NULL, \`lastPaidAt\` datetime NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_4b33993ef90861a10fcf1229d8\` (\`userId\`, \`isActive\`), INDEX \`IDX_275fe11db713fd6f9fd6270991\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`bill\` ADD CONSTRAINT \`FK_275fe11db713fd6f9fd62709917\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bill\` DROP FOREIGN KEY \`FK_275fe11db713fd6f9fd62709917\``);
        await queryRunner.query(`DROP INDEX \`IDX_275fe11db713fd6f9fd6270991\` ON \`bill\``);
        await queryRunner.query(`DROP INDEX \`IDX_4b33993ef90861a10fcf1229d8\` ON \`bill\``);
        await queryRunner.query(`DROP TABLE \`bill\``);
    }

}
