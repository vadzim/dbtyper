import { Controller, Get, Inject } from "@nestjs/common"

import { UsersService } from "./users.service.ts"

@Controller("users")
export class UsersController {
	constructor(@Inject(UsersService) private readonly users: UsersService) {}

	@Get()
	async list() {
		return this.users.listUsers()
	}
}
