export type SqlParseError<Message extends string> = {
	readonly __sql_parse_error__: Message
}
