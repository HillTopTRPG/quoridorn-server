# Quoridorn REST API
Quoridorn Web APIのドキュメントです。<br> `/config/server.yaml`の`webApiPathBase`の値が、各APIのパスの先頭に付与される点をご留意ください。<br> リクエスト例）(host)/(webApiPathBase)/v1/token

## Version: 1.0.0

**License:** [AGPL-3.0 License](https://www.gnu.org/licenses/agpl-3.0.html)

[Find out more about Swagger](http://swagger.io)
### Security
**token_auth**  

|apiKey|*API Key*|
|---|---|
|Name|Authentication|
|In|header|

### /v1/token

#### GET
##### Summary:

サーバー管理者用トークンを取得する

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | サーバーパスワード（`/config/server.yaml`の`webApiPassword`の値） | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | [TokenGetResponse](#tokengetresponse) |
| 400 | パラメータが不足しています |  |
| 401 | サーバーパスワードが違います `Wrong server password.` |  |
| 500 | パスワード照合処理で致命的なエラーが発生しています `Verify process fatal error.` |  |

### /v1/rooms/{roomNo}/token

#### GET
##### Summary:

部屋情報アクセス用トークンを取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> どちらの認証をとっても、レスポンスは同じです。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] {部屋パスワード}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> 部屋パスワード: 部屋作成時に指定したもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `{部屋パスワード}`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string |
| roomNo | path | 部屋番号 | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | [TokenGetResponse](#tokengetresponse) |
| 400 | パラメータが不足しています |  |
| 401 | トークンが必要です `Need token.`<br> トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの種類が違います（サーバー情報用トークンを指定してください） `Different types token. Need server Token.`<br> パスワードが違います `Wrong password.` |  |
| 406 | 部屋番号に対応する部屋情報が存在しません `Room not found.` |  |
| 500 | パスワード照合処理で致命的なエラーが発生しています `Verify process fatal error.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms/{roomNo}/users/{userId}/token

#### GET
##### Summary:

ユーザー情報アクセス用トークンを取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> どちらの認証をとっても、レスポンスは同じです。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] Bearer {部屋情報アクセス用トークン}/{ユーザーパスワード}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> 部屋情報アクセス用トークン: `/v1/rooms/{roomNo}/token`で発行しておいたもの<br> ユーザーパスワード: 入室時にユーザー情報として指定したもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6/{ユーザーパスワード}`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string |
| roomNo | path | 部屋番号 | Yes | integer |
| userId | path | ユーザーID | Yes | string (uuid) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | [TokenGetResponse](#tokengetresponse) |
| 400 | パラメータが不足しています |  |
| 401 | トークンが必要です `Need token.`<br> トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（部屋情報用トークンを指定してください） `Different types token. Need room Token.`<br> パスワードが違います `Wrong password.` |  |
| 406 | 部屋が違います `Different room.`<br> 部屋番号に対応する部屋情報が存在しません `Room not found.`<br> ユーザーIDに対応するユーザー情報が存在しません `User not found.` |  |
| 500 | パスワード照合処理で致命的なエラーが発生しています `Verify process fatal error.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms

#### GET
##### Summary:

部屋情報の一覧を取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> 標準ユーザーで認証した場合、レスポンス項目の一部（必須項目でないもの）が返却されません。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | このパラメータを指定された場合、サーバー管理者ユーザーでの認証とみなします。<br> <br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | No | string (Bearer {サーバー管理者用トークン}) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの種類が違います（サーバー情報用トークンを指定してください） `Different types token. Need server Token.` |  |

### /v1/rooms/{roomNo}

#### GET
##### Summary:

部屋情報を取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> 標準ユーザーで認証した場合、レスポンス項目の一部（必須項目でないもの）が返却されません。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] Bearer {部屋情報アクセス用トークン}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> 部屋情報アクセス用トークン: `/v1/rooms/{roomNo}/token`で発行しておいたもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {token}) |
| roomNo | path | 部屋番号 | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが必要です `Need token.`<br> トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（部屋情報用トークンを指定してください） `Different types token. Need room Token.` |  |
| 406 | 部屋が違います `Different room.`<br> 部屋番号に対応する部屋情報が存在しません `Room not found.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

#### DELETE
##### Summary:

部屋情報を削除する

##### Description:

このリクエストはサーバー管理者ユーザー専用です。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {サーバー管理者用トークン}) |
| roomNo | path | 部屋番号 | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが必要です `Need token.`<br> トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（管理者用トークンを指定してください） `Different types token. Need admin Token.` |  |
| 406 | 部屋番号に対応する部屋情報が存在しません `Room not found.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms/{roomNo}/users

#### GET
##### Summary:

ユーザー情報の一覧を取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> 標準ユーザーで認証した場合、レスポンス項目の一部（必須項目でないもの）が返却されません。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] Bearer {部屋情報アクセス用トークン}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> 部屋情報アクセス用トークン: `/v1/rooms/{roomNo}/token`で発行しておいたもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {token}) |
| roomNo | path | 部屋番号 | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが必要です `Need token.`<br> トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（部屋情報用トークンを指定してください） `Different types token. Need room Token.` |  |
| 406 | 部屋が違います `Different room.`<br> 部屋番号に対応する部屋情報が存在しません `Room not found.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms/{roomNo}/users/{userId}

#### GET
##### Summary:

ユーザー情報を取得する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> 標準ユーザーで認証した場合、レスポンス項目の一部（必須項目でないもの）が返却されません。

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] Bearer {ユーザー情報アクセス用トークン}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> ユーザー情報アクセス用トークン: `/v1/rooms/{roomNo}/users/{userId}/token`で発行しておいたもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {token}) |
| roomNo | path | 部屋番号 | Yes | integer |
| userId | path | ユーザーID | Yes | string (uuid) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（ユーザー情報用トークンを指定してください） `Different types token. Need user Token.` |  |
| 406 | 部屋が違います `Different room.`<br> 部屋番号に対応する部屋情報が存在しません `Room not found.`<br> ユーザーが違います `Different user.`<br> ユーザーIDに対応するユーザー情報が存在しません `User not found.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms/chat

#### POST
##### Summary:

全ての部屋に対してチャット発言を登録する

##### Description:

このリクエストはサーバー管理者ユーザー専用です。<br> 発言情報としてサーバー管理者からのものであることが記録されます。<br> （Quoridornクライアントで表示される際に装飾されます）

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {サーバー管理者用トークン}) |
| body | body |  | Yes | [ChatPostRequestBody](#chatpostrequestbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（部屋情報用トークンを指定してください） `Different types token. Need room Token.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### /v1/rooms/{roomNo}/chat

#### POST
##### Summary:

チャット発言を登録する

##### Description:

このリクエストは２通りの認証があります。<br> ・標準ユーザー<br> ・サーバー管理者ユーザー<br> 認証方法によって、HTTPリクエストヘッダーの項目「Authorization」の指定の仕方を変えてください。<br> サーバー管理者ユーザーで認証された場合は発言情報としてサーバー管理者からのものであることが記録されます。<br> （Quoridornクライアントで表示される際に装飾されます）

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| Authorization | header | ２通りの認証におけるこの項目の値のフォーマットは以下の通りです。<br> [標準ユーザー] Bearer {部屋情報アクセス用トークン}<br> [サーバー管理者ユーザー] Bearer {サーバー管理者用トークン}<br> <br> 部屋情報アクセス用トークン: `/v1/rooms/{roomNo}/token`で発行しておいたもの<br> サーバー管理者用トークン: `/v1/token`で発行しておいたもの<br> <br> 設定値の例)<br> [標準ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6`<br> [サーバー管理者ユーザー] `Bearer 3fa85f64-5717-4562-b3fc-2c963f66afa6` | Yes | string (Bearer {token}) |
| roomNo | path | 部屋番号 | Yes | integer |
| body | body |  | Yes | [ChatPostRequestBody](#chatpostrequestbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 成功 | object |
| 400 | パラメータが不足しています |  |
| 401 | トークンが無効です `Invalid token.`<br> トークンが有効期限切れです `Expired token.`<br> トークンの対象が違います `Different token target.`<br> トークンの種類が違います（部屋情報用トークンを指定してください） `Different types token. Need room Token.` |  |
| 406 | 部屋が違います `Different room.`<br> 部屋番号に対応する部屋情報が存在しません `Room not found.`<br> ユーザーIDに対応するユーザー情報が存在しません `User not found.` |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| token_auth | |

### Models


#### TokenGetResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| result | boolean |  | No |
| token | string (uuid) |  | No |
| expires | dateTime | トークンの有効期限（`/config/server.yaml`の`webApiTokenExpires`の項目が有効期間の指定） | No |

#### RoomInfo

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| roomNo | integer | 部屋番号 | Yes |
| name | string | 部屋名 | Yes |
| memberNum | integer | 入室人数(接続数ではなくユーザー数) | No |
| bcdiceServer | string | BCDice-APIサーバの向き先 | No |
| system | string | 選択されているダイスボット | No |
| roomCollectionPrefix | string | 部屋情報Collectionの接頭句 | No |
| storageId | string | s3サーバーに保存される際の共通パス | No |
| createTime | string | この部屋情報が作成された日時 | No |
| updateTime | string | この部屋情報が更新された日時 | No |

#### UserInfo

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| roomNo | integer | 部屋番号 | Yes |
| userId | string (uuid) | ユーザーID | Yes |
| name | string | ユーザー名 | Yes |
| type | string | ユーザー種別 | Yes |
| login | integer | ログインしている接続数 | No |
| createTime | string | この部屋情報が作成された日時 | No |
| updateTime | string | この部屋情報が更新された日時 | No |

#### ChatPostRequestBody

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| userId | string (uuid) |  | Yes |
| text | string |  | Yes |