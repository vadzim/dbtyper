import { Controller, Get, Inject } from "@nestjs/common"

import { UsersService } from "./users.service.ts"

@Controller("users")
export class UsersController {
	constructor(@Inject(UsersService) private readonly users: UsersService) {}

	@Get()
	async list() {
		return (await this.users.listUsers()).map(user => ({
			email: user.email,
			display_name: user.display_name,
			created_at: user.created_at,
		}))
	}
}
