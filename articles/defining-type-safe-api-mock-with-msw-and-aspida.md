---
title: "MSW x Aspida で型安全な API モックを定義する"
emoji: "🧩"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["TypeScript", "msw", "aspida"]
published: true
---

MSW と Aspida を組み合わせたときに、API のパスやメソッドに応じてレスポンスの型を推論させる方法を紹介します。

- まず、API レスポンスの型が推論されない問題のあるコードを提示します
- 次に、最低限型推論される比較的簡単なコードを紹介します
- そして、実装した型定義の型推論の流れを追い理解を深めた後、より良い実装を検討します
- 最後に、自分が普段使っているテンプレートを紹介します
  - ここだけ見れば欲しい情報は見つかると思います

## 前提知識
- [TypeScript の utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [MSW](https://mswjs.io/)(Mock Service Worker)
  - 紹介記事: https://zenn.dev/takepepe/articles/msw-driven-development
- [Aspida](https://github.com/aspida/aspida)
  - 紹介記事: https://zenn.dev/solufa/articles/getting-started-with-aspida

## 何も考えずモックを定義したときに起こる型安全性の問題
まず、以下のような Aspida を利用した API の定義があるとします。

```ts:api/sample/index.ts
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
```

`/sample` に対して GET リクエストを送ると、`User[]` 型のレスポンスが返ってきます。
一方 POST リクエストを送ると、`User` 型のレスポンスが返ってきます。
リクエストボディなどの定義もありますが、今回はリクエスト情報に依らないレスポンスハンドラの作成が目的なので無視します。

この API に対して、通常以下のような MSW のハンドラを定義すると思います(説明のため、多少簡単にしています)。

```ts:handler.ts
import { DefaultBodyType, rest } from 'msw'
import aspida from '@aspida/axios'
import api from './api/$api'
import axios from 'axios'

const apiClient = api(aspida(axios))

type Method = keyof typeof rest
// (別段推奨しないですが)より厳密に型を定義したい場合はこうする
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
```

`createHandler` は API のパス・メソッド・レスポンスを渡すことで MSW のモックハンドラを作成する関数です。
コードコメントにある通り、`createHandler` は型安全性を保証してくれません。
`/sample` に対して GET リクエストを送ると、`string` 型のレスポンスが返るハンドラが作成できてしまいます。

## パス・メソッドに応じてレスポンスの型を推論させる

```ts:handler.ts
import { DefaultBodyType, rest } from 'msw'
import aspida from '@aspida/axios'
import api from './api/$api'
import axios from 'axios'

const apiClient = api(aspida(axios))

type Method = keyof typeof rest

type Api<M extends Method, R extends DefaultBodyType> = {
  $path: () => string
  // モック作成にあたっては、query や body の型は気にしないので any で定義
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
```

`Api` 型は、対象の API において例えば GET リクエストであれば

- `$path` 関数が API パスを返すこと
- `$get` 関数が API レスポンスを非同期で返すこと

を示します。

`M` 型引数は必ずメソッド名になるように `M extends Method` としています。
また、`R` (Response) 型引数は MSW の `ctx.json` 関数にフィットさせるため `R extends DefaultBodyType` としています。
`Record` 型の中身の `$${M}` はぱっと見ややこしいかもしれませんが、

- `` `${M}` `` は、例えば `M` が `'get'` であれば`'get'` となるテンプレートリテラル型
- `` `$${M}` `` ならば `'$get'` という型になる

という風になっています。
この `Api` 型を `createHandler` 関数で利用することにより、パス・メソッドに応じてレスポンスの型を推論させることができました。

## 型推論の流れを追い、より良い実装を検討する
比較的簡単な実装にしたもののやはり多少複雑なので、理解を深めるために型推論の流れを追ってみます。
私自身あまり型推論の流れを追う経験がなかったので、TypeScriptの型推論詳説を参考にさせていただきました。

https://qiita.com/uhyo/items/6acb7f4ee73287d5dac0

さて、以下のように `createHandler` を呼び出した場合を考えてみます。

```ts
  type Api<M extends Method, R extends DefaultBodyType> = {
    $path: () => string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & Record<`$${M}`, (args: any) => Promise<R>>

  const createHandler = <M extends Method, R extends DefaultBodyType>(path: Api<M, R>, method: M, response?: R) =>
    rest[method](path.$path(), (_, res, ctx) => {
      return res(ctx.json(response))
    })

  // これ
  createHandler(apiClient.sample, 'get', [{ id: 1, name: 'foo' }]),
```

型推論の流れは、

1. `method` 引数に `get` が渡されていることにより、 `M` 型が `'get'` と推論される
    - `path` 引数は contextual typing が必要なので推論が後回しにされる
2. `response` 引数に `{id: number; name: string;}[]` 、すなわち `User[]` 型が渡されていることにより、 `R` 型が `User[]` と推論される
3. ( `Api<'get', User[]>` 型の引数 `path` には `apiClient.sample` が渡されている。この引数は次のような型を持っている )
    ```ts
    {
      $path: () => '/sample', // () => string
      $get: (args: any) => Promise<User[]>, // Record<`$get`, (args: any) => Promise<User[]>>
    }
    ```
4. ( `Api<'get', User[]>` 型が、 `apiClient.sample` と矛盾していないか型検査が働く。ここでは矛盾していないのでエラーにならない )
    - このタイミングで M, R 型が確定する。多分。

となるはずです。
さて、実は今回の実装では誤ったレスポンス定義を書いた場合、エラーの波線が `response` 引数でなく `path` 引数上に出てしまいます。

```ts
createHandler(apiClient.sample, 'post', { id: 'omg', name: 'foo' }),
              ^^^^^^^^^^^^^^^^          ^^^^^^^^^^^^^^^^^^^^^^^^^^
              ↑エラー波線が出る位置        ↑実際に直す箇所はここのはず？
```

これは、先ほどの手順4で `apiClient.sample` の型検査が行われた段階で型エラーが発見されるためだと考えられるでしょう。
`response` 引数の推論タイミングを遅らせてやれば良さそうです。今回は次のように実装しました。

```ts:handler.ts
const createHandler = <
  M extends Method,
  Api extends {
    $path: () => string
    // モック作成にあたっては、query や body の型は気にしないのでanyで定義
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & Record<`$${M}`, (args: any) => unknown>
>(
  path: Api,
  method: M,
  response?: ReturnType<Api[`$${M}`]> extends Promise<infer S> ? S : never
) =>
  rest[method](path.$path(), (_, res, ctx) => {
    return res(ctx.json(response))
  })

  createHandler(apiClient.sample, 'post', { id: 'omg', name: 'foo' })
                                            ^^
                                            ここに出るようになった
```

これも、以下のコードを例に推論の流れを追ってみます。

```ts
  createHandler(apiClient.sample, 'get', [{ id: 1, name: 'foo' }]),
```

1. `method` 引数に `get` が渡されていることにより、 `M` 型が `'get'` と推論される
2. `path` 引数に `apiClient.sample` が渡されていることにより、 `Api` 型が以下のように推論される（はず...）
    ```ts
    {
      $path: () => string
      $get: (args: any) => Promise<User[]>
    }
    ```
3. ( `response` 引数の型は複雑であるが、一つずつ考えると理解できる)
    1. `` Api[`$${M}`}] `` は `Api['$get']` であり、 `(args: any) => Promise<User[]>` である
    2. `` ReturnType<Api[`$${M}`}]> `` は `Promise<User[]>` である
    3. `Promise<User[]>` から `S` が `User[]` であることが分かる
4. `response` 引数が `User[]` と推論される

となるはずですが、正直自信がないので間違えていたらご指摘お願いします。
一旦雰囲気は掴めるかなと思います。
これで、エラーの出る位置が改善されました。

## 自分が普段使っているテンプレートの紹介
これまでのコードでも十分ですが、実際に自分が普段使っているテンプレートを紹介しておきます。
ステータスコードの指定や、テストの際に便利な `onRequest` 関数が使えるようになっています。

```ts:handler.ts
import { DefaultBodyType, PathParams, rest } from 'msw'
import { apiClient } from '~/utils/apiClient'
import { AxiosRequestConfig } from 'axios'

type Method = keyof typeof rest
type Status = number

const delayMs = process.env.NODE_ENV === 'test' ? 0 : 300

type OnRequestArgs = Partial<{
  params: PathParams;
  body: Promise<unknown>;
}>;

type CreateHandlerOption<Response> = Partial<{
  response: Response
  onRequest: (args?: OnRequestArgs) => unknown
}>
const createHandler = (path: string, method: Method, status: Status, options?: CreateHandlerOption<DefaultBodyType>) =>
  rest[method](path, (_, res, ctx) => {
    if (options?.onRequest) {
      try {
        options.onRequest({ params: req.params, body: await req.json() });
      // ボディのない POST メソッド を呼ぶときに req.json() がパースエラーを起こすことがある
      } catch {
        options.onRequest({ params: req.params });
      }
    }
    return res(ctx.status(status), ctx.delay(delayMs), ctx.json(options?.response))
  })

export const getWith200 = <
  Api extends { $path: () => string } & Record<'$get', (args: { config?: AxiosRequestConfig }) => unknown>
>(
  path: Api,
  options?: CreateHandlerOption<
    ReturnType<Api['$get']> extends Promise<infer Response> ? (Response extends DefaultBodyType ? Response : never) : never
  >
) => createHandler(path.$path(), 'get', 200, options)
export const postWith201 = <
  Api extends { $path: () => string } & Record<'$post', (args: Parameters<Api['$post']>[0]) => unknown>
>(
  path: Api,
  options?: CreateHandlerOption<
    ReturnType<Api['$post']> extends Promise<infer Response> ? (Response extends DefaultBodyType ? Response : never) : never
  >
) => createHandler(path.$path(), 'post', 200, options)
export const putWith200 = <
  Api extends { $path: () => string } & Record<'$put', (args: Parameters<Api['$put']>[0]) => unknown>
>(
  path: Api,
  options?: CreateHandlerOption<
    ReturnType<Api['$put']> extends Promise<infer Response> ? (Response extends DefaultBodyType ? Response : never) : never
  >
) => createHandler(path.$path(), 'put', 200, options)

export const handlers = [
  // Define handlers...
]

```

MSW x Aspida でモックハンドラを定義するプロジェクトで使ってみてください。
