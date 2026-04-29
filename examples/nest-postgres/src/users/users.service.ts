import { Inject, Injectable } from "@nestjs/common"
import type { ConnectedDataBase } from "typesql"
import { TYPESQL_CONNECTED } from "@typesql/nest"

import type { ExampleDbShape } from "../example-schema.ts"

@Injectable()
export class UsersService {
	constructor(@Inject(TYPESQL_CONNECTED) readonly db: ConnectedDataBase<ExampleDbShape>) {}

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
