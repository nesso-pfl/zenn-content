import { DefaultBodyType, rest } from 'msw'
import aspida from '@aspida/axios'
import api from './api/$api'
import axios from 'axios'

const apiClient = api(aspida(axios))

type Method = keyof typeof rest
// より厳密に型を定義したい場合
// type Method = Pick<keyof typeof rest, 'get' | 'post'>

// MSW の ctx.json の引数の型は DefaultBodyType で定義されている
const createHandler = (path: string, method: Method, response?: DefaultBodyType) =>
  rest[method](path, (_, res, ctx) => {
    return res(ctx.json(response))
  })

export const handlers = [
  createHandler(apiClient.sample.$path(), 'get', [{ id: 1, name: 'foo' }]),
  // User[] 型でないのでエラーを検知してほしい
  createHandler(apiClient.sample.$path(), 'get', 'omg'),
  createHandler(apiClient.sample.$path(), 'post', { id: 1, name: 'foo' }),
  // User 型でないのでエラーを検知してほしい
  createHandler(apiClient.sample.$path(), 'post', { id: 'omg', name: 'foo' }),
]
