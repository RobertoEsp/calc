export class ParseError extends Error {
  readonly position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'ParseError'
    this.position = position
  }
}
