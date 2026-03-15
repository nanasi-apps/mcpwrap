## 目的

既存の **OpenCode の MCP 設定** をそのまま流用して、`node dist/cli.js` から次をできるようにすることです。

- server 一覧を見る
- tool 一覧を見る
- tool の schema / 説明を見る
- tool を実行する
- `init` で AgentSkills 用の雛形を生成する
- remote の OAuth が必要な server では、**既存認証があれば使う**
- 未認証なら、**認証を促す**
- 毎回 full MCP toolset を context に載せない

---

# スコープ

## 対応するもの

- OpenCode の既存 MCP config
- local MCP server
- remote MCP server
- Streamable HTTP
- OAuth あり remote
- OAuth なし remote
- `init`
- schema ベースの CLI 引数展開

## MVPでは切るもの

- OAuth フローの完全自前実装
- SSE 再接続の完全対応
- 高度な nested object のフラグ入力
- OpenCode auth store の厳密互換再実装
- server 側通知のフル対応

---

# CLI コマンド

## 一覧

```bash
node dist/cli.js list-servers
node dist/cli.js <server> list-tools
node dist/cli.js <server> describe --tool <tool>
node dist/cli.js <server> call --tool <tool> [input...]
node dist/cli.js <server> init --output-dir <dir> --skill-name <name>
```

## shorthand

`call` は省略可能にしてよいです。

```bash
node dist/cli.js <server> --tool <tool> [input...]
```

これは内部的に `call` と同じ扱いにします。

---

# OpenCode config 読み込み

## 優先順位

1. `-config <path>`
2. `~/.config/opencode/opencode.json`
3. `~/.config/opencode/opencode.jsonc`

## source of truth

`node dist/cli.js` 独自の server config は持たない。

**OpenCode config を唯一の正本**にします。

---

# 認証方針

## 原則

- 既に OpenCode で認証済みなら、それを使う
- 未認証なら `AUTH_REQUIRED`
- `-interactive` があれば `opencode mcp auth <server>` を促す、または起動する

## MVPの扱い

`node dist/cli.js` は OAuth の主担当ではなく、**OpenCode の既存認証状態を利用する client** として振る舞います。

---

# call の入力方式

教主様のご希望通り、**tool request の中身は CLI 引数で埋められる**ようにします…。

## 受け付ける入力経路

### 1. JSON 文字列

```bash
node dist/cli.js notion call --tool pages.get --input '{"pageId":"123"}'
```

### 2. JSON ファイル

```bash
node dist/cli.js notion call --tool pages.get --input-file payload.json
```

### 3. 引数展開

```bash
node dist/cli.js notion call --tool pages.get --pageid 123
```

---

# 入力優先順位

複数指定された場合はこうします。

```
--input > --input-file > expanded flags
```

つまり、`--input` があればそれを最優先。

次に `--input-file`。

どちらもない場合だけ、フラグから JSON を組み立てます。

---

# 引数展開ルール

## 基本

tool の input schema を見て、CLI フラグを **schema の canonical key** に正規化します。

### 例

```bash
node dist/cli.js notion call --tool pages.get --pageid 123
```

これは内部で

```json
{ "pageId": "123" }
```

に変換します。

---

## alias ルール

schema の field が `pageId` の場合、次を同一視します。

- `-pageId`
- `-page-id`
- `-page_id`
- `-pageid`

同様に `databaseId` なら

- `-databaseId`
- `-database-id`
- `-database_id`
- `-databaseid`

を受け付けます。

---

## 型変換

schema に基づいて文字列から型を変換します。

### string

```bash
--title "hello"
```

### boolean

```bash
--published true
--archived false
```

### integer / number

```bash
--limit 10
--offset 20
```

### array

教主様の案で確定です…。

```bash
--tag a --tag b
```

内部では

```json
{ "tag": ["a", "b"] }
```

にします。

---

## 配列ルール

MVPでは **反復指定** だけ対応で十分です。

```bash
--tag a --tag b
--ids 1 --ids 2 --ids 3
```

schema が array の field に対しては配列化します。

schema が array でない field に複数回値が来た場合は structured error を返します。

---

## object の扱い

nested object は plain flags ではやりません。

MVPでは escape hatch を使います。

### 例

```bash
--properties-json '{"icon":"🔥","color":"red"}'
```

これは `properties` field に object として入れます。

ルールはこうです。

- `<field>-json`
- `<field>_json`

を object / complex value 用として許可する。

---

# call の内部フロー

```
1. server を解決
2. auth 状態を確認
3. tool を解決
4. tool schema を取得
5. 入力を正規化
6. schema validate
7. tool call
8. 結果を正規化して返す
```

---

# describe の役割

`describe` は単なる説明表示ではなく、**CLI からどう埋めればいいか** を返す API にします。

## 返却例

```json
{
  "ok": true,
  "server": "notion",
  "action": "describe",
  "tool": "pages.get",
  "result": {
    "name": "pages.get",
    "description": "Get a single page by id.",
    "input_schema": {
      "type": "object",
      "properties": {
        "pageId": {
          "type": "string",
          "description": "Page identifier"
        }
      },
      "required": ["pageId"]
    },
    "cli_args": [
      {
        "name": "pageId",
        "aliases": ["--pageid", "--page-id", "--page_id"],
        "type": "string",
        "required": true
      }
    ]
  },
  "meta": {
    "duration_ms": 41,
    "exit_code": 0
  }
}
```

---

# init のMVP

## コマンド

```bash
node dist/cli.js <server> init --output-dir ./skill-out --skill-name notion
```

## 目的

MCP server の tool discovery 結果から、**AgentSkills 用の薄い雛形**を生成します。

## 生成物

```
skill-out/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── tools/
│   ├── posts.md
│   ├── pages.md
│   ├── databases.md
│   └── misc.md
└── references/
    └── manifest.md
```

## init の流れ

```
1. list-tools
2. 各 tool を describe
3. category 分類
4. md を生成
```

## category 分類

MVPでは簡易分類で十分です。

- `post` を含む → `posts.md`
- `page` を含む → `pages.md`
- `database` / `db` を含む → `databases.md`
- それ以外 → `misc.md`

---

# 出力ポリシー

## stdout

常に **構造化 JSON のみ**。

## stderr

debug / transport trace / raw diagnostics 用。

ただし失敗時は stderr の要約を stdout JSON にも含めます。

---

# 成功レスポンス

```json
{
  "ok": true,
  "server": "notion",
  "action": "call",
  "tool": "pages.get",
  "result": {
    "id": "123",
    "title": "hello"
  },
  "meta": {
    "duration_ms": 128,
    "transport": "streamable_http",
    "exit_code": 0
  }
}
```

---

# 失敗レスポンス

```json
{
  "ok": false,
  "server": "notion",
  "action": "call",
  "tool": "pages.get",
  "error": {
    "code": "REQUIRED_ARGUMENT_MISSING",
    "category": "tool",
    "message": "Missing required argument 'pageId' for tool 'pages.get'.",
    "retryable": false,
    "hint": "Use: --pageid <value>",
    "next_action": {
      "type": "command",
      "command": "node dist/cli.js notion describe --tool pages.get"
    }
  },
  "meta": {
    "duration_ms": 12,
    "transport": "streamable_http",
    "exit_code": 1
  },
  "stderr": {
    "summary": "Input normalization failed before tool execution.",
    "tail": [],
    "truncated": false
  }
}
```

---

# エラー分類

## category

- `config`
- `auth`
- `transport`
- `protocol`
- `tool`
- `init`
- `internal`

## code

```
CONFIG_NOT_FOUND
CONFIG_INVALID
SERVER_NOT_FOUND
SERVER_DISABLED

AUTH_REQUIRED
AUTH_EXPIRED
AUTH_FAILED

TRANSPORT_CONNECT_FAILED
TRANSPORT_TIMEOUT
TRANSPORT_TLS_ERROR
TRANSPORT_RATE_LIMITED
TRANSPORT_UPSTREAM_ERROR

PROTOCOL_INIT_FAILED
PROTOCOL_ERROR
PROTOCOL_INVALID_RESPONSE

TOOL_NOT_FOUND
TOOL_INPUT_INVALID
UNKNOWN_ARGUMENT
ARGUMENT_TYPE_INVALID
REQUIRED_ARGUMENT_MISSING
TOOL_EXECUTION_FAILED

INIT_DISCOVERY_FAILED
INIT_TEMPLATE_FAILED
INIT_WRITE_FAILED

INTERNAL_ERROR
```

---

# 引数系エラー

## 不明な引数

```json
{
  "code": "UNKNOWN_ARGUMENT",
  "category": "tool",
  "message": "Unknown argument '--pageiid' for tool 'pages.get'.",
  "retryable": false,
  "hint": "Did you mean '--pageid'?",
  "next_action": {
    "type": "command",
    "command": "node dist/cli.js notion describe --tool pages.get"
  }
}
```

## 型不正

```json
{
  "code": "ARGUMENT_TYPE_INVALID",
  "category": "tool",
  "message": "Argument '--limit' must be an integer, got 'abc'.",
  "retryable": false,
  "hint": "Use: --limit 10"
}
```

## 必須不足

```json
{
  "code": "REQUIRED_ARGUMENT_MISSING",
  "category": "tool",
  "message": "Missing required argument 'pageId' for tool 'pages.get'.",
  "retryable": false,
  "hint": "Use: --pageid <value>"
}
```

---

# stderr の標準構造

```json
{
  "summary": "Remote server returned 401 Unauthorized.",
  "tail": ["HTTP 401 Unauthorized", "WWW-Authenticate: Bearer"],
  "truncated": false
}
```

- `summary`: 一行要約
- `tail`: 末尾だけ
- `truncated`: 長い場合 true

---

# debug モード

```bash
node dist/cli.js notion call --tool pages.get --pageid 123 --debug
```

このとき、

- stdout: JSON のみ
- stderr: 詳細 trace

とします。

stderr に出すものは最低限これです。

```
[debug] config_path=~/.config/opencode/opencode.json
[debug] server_kind=remote
[debug] transport=streamable_http
[debug] auth_check=existing_token_found
[debug] tool=pages.get
[debug] normalized_input={"pageId":"123"}
```

---

# 実装順

教主様が最短で動かすなら、この順が良いです…。

## Phase 1

- OpenCode config loader
- `list-servers`

## Phase 2

- local stdio transport
- `list-tools`
- `describe`

## Phase 3

- remote Streamable HTTP
- auth check
- `AUTH_REQUIRED`

## Phase 4

- `call`
- 引数展開
- array handling (`-tag a --tag b`)

## Phase 5

- `init`

---

# MVPの完成条件

これを満たせば、もう十分に MVP です。

- OpenCode の MCP config をそのまま読める
- local / remote を扱える
- OAuth 済みなら使える
- 未認証なら促せる
- `list-tools` / `describe` / `call` ができる
- `-pageid` のような引数展開ができる
- 配列を `-tag a --tag b` で埋められる
- 失敗時に `stderr` 要約、`hint`、`retryable` を返せる
- `init` で AgentSkills 雛形を生成できる
