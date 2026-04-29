import { Injectable } from "@nestjs/common"
import { InjectTypesql } from "@typesql/nest"
import type { ExampleDb } from "../example-schema.ts"
import { TYPESQL_ID } from "../typesql-connection.ts"

@Injectable()
export class UsersService {
	constructor(@InjectTypesql(TYPESQL_ID) readonly db: ExampleDb) {}

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
