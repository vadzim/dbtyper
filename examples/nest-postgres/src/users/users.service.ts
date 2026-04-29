import { Injectable } from "@nestjs/common"
import type { DataBase } from "typesql"
import { InjectTypesql } from "@typesql/nest"

import type { ExampleDbShape } from "../example-schema.ts"

@Injectable()
export class UsersService {
	constructor(@InjectTypesql() readonly db: DataBase<ExampleDbShape>) {}

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
