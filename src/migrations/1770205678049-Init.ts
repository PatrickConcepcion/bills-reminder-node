import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1770205678049 implements MigrationInterface {
    name = 'Init1770205678049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`refresh_token\` (\`id\` varchar(36) NOT NULL, \`userId\` varchar(255) NOT NULL, \`sessionId\` varchar(255) NOT NULL, \`familyId\` varchar(255) NOT NULL, \`tokenHash\` varchar(255) NOT NULL, \`expiresAt\` datetime NOT NULL, \`isRevoked\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_c03a9271901099da2a840b0312\` (\`expiresAt\`), INDEX \`IDX_b803086815f2d539fe7a0349d1\` (\`familyId\`), INDEX \`IDX_aa5d23e946f1e4dc31a57ee1a5\` (\`userId\`, \`isRevoked\`), UNIQUE INDEX \`IDX_4f310b2b1f45ec02710a719361\` (\`sessionId\`), UNIQUE INDEX \`IDX_204f27bcee2b705b8230beaf41\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD CONSTRAINT \`FK_8e913e288156c133999341156ad\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP FOREIGN KEY \`FK_8e913e288156c133999341156ad\``);
        await queryRunner.query(`DROP INDEX \`IDX_204f27bcee2b705b8230beaf41\` ON \`refresh_token\``);
        await queryRunner.query(`DROP INDEX \`IDX_4f310b2b1f45ec02710a719361\` ON \`refresh_token\``);
        await queryRunner.query(`DROP INDEX \`IDX_aa5d23e946f1e4dc31a57ee1a5\` ON \`refresh_token\``);
        await queryRunner.query(`DROP INDEX \`IDX_b803086815f2d539fe7a0349d1\` ON \`refresh_token\``);
        await queryRunner.query(`DROP INDEX \`IDX_c03a9271901099da2a840b0312\` ON \`refresh_token\``);
        await queryRunner.query(`DROP TABLE \`refresh_token\``);
    }

}
