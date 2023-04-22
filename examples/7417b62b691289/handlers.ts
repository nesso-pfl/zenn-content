import { DefaultBodyType, rest } from 'msw'
import aspida from '@aspida/axios'
import api from './api/$api'
import axios from 'axios'

const apiClient = api(aspida(axios))

type Method = keyof typeof rest
type Api<M extends Method, R extends DefaultBodyType> = {
  $path: () => string
  // モック作成にあたっては、query や body の型は気にしないのでanyで定義
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<`$${M}`, (args: any) => Promise<R>>

const createHandler = <M extends Method, R extends DefaultBodyType>(path: Api<M, R>, method: M, response?: R) =>
  rest[method](path.$path(), (_, res, ctx) => {
    return res(ctx.json(response))
  })

export const handlers = [
  createHandler(apiClient.sample, 'get', [{ id: 1, name: 'foo' }]),
  // @ts-expect-error User[] 型でないのでエラー
  createHandler(apiClient.sample, 'get', 'omg'),
  createHandler(apiClient.sample, 'post', { id: 1, name: 'foo' }),
  // @ts-expect-error User 型でないのでエラー
  createHandler(apiClient.sample, 'post', { id: 'omg', name: 'foo' }),
  // @ts-expect-error もちろん存在しないメソッドを指定した場合もエラー
  createHandler(apiClient.sample, 'put'),
]
