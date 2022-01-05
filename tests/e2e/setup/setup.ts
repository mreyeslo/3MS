/* eslint-disable no-console */

import knex from 'knex';
import { sleep } from './utils/sleep';
import Listr from 'listr';
import vendors from '../get-dbs-to-test';
import config from '../config';
import global from './global';
import { spawn, spawnSync } from 'child_process';

let started = false;

export default async (): Promise<void> => {
	if (started) return;
	started = true;

	console.log('\n\n');

	console.log(`👮‍♀️ Starting tests!\n`);

	await new Listr([
		{
			title: 'Bootstrap databases and start servers',
			task: async () => {
				return new Listr(
					vendors.map((vendor) => {
						return {
							title: config.names[vendor]!,
							task: async () => {
								const env = {
									...config.envs[vendor]!,
									ADMIN_EMAIL: 'admin@example.com',
									ADMIN_PASSWORD: 'password',
									KEY: 'directus-test',
									SECRET: 'directus-test',
									TELEMETRY: 'false',
									CACHE_SCHEMA: 'false',
									CACHE_ENABLED: 'false',
									RATE_LIMITER_ENABLED: 'false',
								};
								spawnSync('sh', ['-lc', 'npx directus bootstrap'], { env });
								const server = spawn('sh', ['-lc', 'npx directus start'], { env });
								global.directus[vendor] = server;
							},
						};
					}),
					{ concurrent: true }
				);
			},
		},
		{
			title: 'Migrate and seed databases',
			task: async () => {
				return new Listr(
					vendors.map((vendor) => {
						return {
							title: config.names[vendor]!,
							task: async () => {
								const database = knex(config.knexConfig[vendor]!);
								await database.migrate.latest();
								await database.seed.run();
								await database.destroy();
							},
						};
					}),
					{ concurrent: true }
				);
			},
		},
	]).run();

	await sleep(10000);
	console.log('\n');
};
