import { DefineMethods } from 'aspida'

type User = {
  id: number
  name: string
}

export type Methods = DefineMethods<{
  get: {
    query?: {
      limit: number
    }
    resBody: User[]
  }

  post: {
    reqBody: {
      name: string
    }
    resBody: User
  }
}>
