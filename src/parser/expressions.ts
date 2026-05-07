type _BinaryOperator = {
	"+": {
		priority: 10
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
	"-": {
		priority: 10
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
	"*": {
		priority: 20
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
	"/": {
		priority: 20
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
	"%": {
		priority: 20
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
	"**": {
		priority: 30
		types: [
			{
				args: [number, number]
				result: number
			},
		]
	}
}
