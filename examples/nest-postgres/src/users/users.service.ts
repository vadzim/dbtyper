import { Injectable } from "@nestjs/common"
import { InjectDbtyper } from "@dbtyper/nest"
import type { ExampleDb } from "../example-schema.ts"
import { DBTYPER_ID } from "../dbtyper-connection.ts"

@Injectable()
export class UsersService {
	constructor(@InjectDbtyper(DBTYPER_ID) readonly db: ExampleDb) {}

	async listUsers() {
		return this.db.query(`
			select
				public.agenda.*,
				email,
				display_name,
				auth.users.created_at,
				auth.users.login_count
			from auth.users
			left join public.agenda
			on auth.users.id = public.agenda.user_id
			order by email;
		`)
	}
}
