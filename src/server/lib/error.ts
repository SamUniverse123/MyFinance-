
type Code = 'unauthorized'|'not_found' | 'conflict' | 'forbidden' | 'invalid'
type Status = 401| 404 | 409 | 403 | 422

const STATUS: Record<Code, Status> = {
	unauthorized: 401,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  invalid: 422,
}

export class AppError extends Error {
  readonly status: Status
  constructor(
    readonly code: Code,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
    this.status = STATUS[code]
  }
}