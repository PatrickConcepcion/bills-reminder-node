import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameBillPaidAt1770269780000 implements MigrationInterface {
    name = 'RenameBillPaidAt1770269780000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bill\` CHANGE \`lastPaidAt\` \`paidAt\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bill\` CHANGE \`paidAt\` \`lastPaidAt\` datetime NULL`);
    }
}
