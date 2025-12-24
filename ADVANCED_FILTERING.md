# 高度なフィルタリング（メモ）

※ 画像から転記した記録です。

通常のクエリに加えて、検索を絞り込むためのフィールドも提供しています。これらのフィールドはまだUIとして提供されていませんが、特別な構文で利用可能です。

構文は `{<フィールド> <演算子> <値>}` です。

## 構文

| 内容 | 値 | 説明 | 例 |
| --- | --- | --- | --- |
| フィールド | コンテンツタイプごとに使用可能な値については、以下の表を参照してください | フィルターするフィールド | `duration` |
| 演算子 | `=`, `:`, `!=` | 等しい、部分的に等しい、等しくない | `{duration=60}` `{title_en: miku}` `{title_en!=miku}` |
| 演算子 | `>`, `>=` | より大きい、以上 | `{duration>60}` `{duration>=60}` |
| 演算子 | `<`, `<=` | より小さい、以下 | `{duration<60}` `{duration<=60}` |
| 演算子 | `[]`, `![]` | いずれか1つ、いずれでもない | `{tags: [Hatsune_miku]}` `{tags: [something_else]}` |
| 演算子 | `[..]` | 範囲 | `{duration: [60..120]}` |

## 利用可能なフィールド

| コンテンツ | 利用可能なフィールド |
| --- | --- |
| ユーザー | `username`, `body*`, `name*`, `date` |
| 動画 | `title*`, `body*`, `author`, `rating`, `private`, `duration`, `likes`, `views`, `comments`, `tags**`, `date` |
| 画像 | `title*`, `body*`, `author`, `rating`, `likes`, `views`, `comments`, `images`, `tags**`, `date***` |
| 投稿 | `title*`, `body*`, `author`, `date***` |
| フォーラムスレッド | `title*`, `author`, `date***` |
| フォーラム投稿 | `body*`, `author`, `date***` |
| 再生リスト | `title*`, `author`, `videos`, `date***` |

### 注記

- `*` これらのフィールドはローカライズされているため、フィルターとして使用するには、`_en`、`_ja`、または `_zh` を追加する必要があります。
- `**` これらのフィールドは `[String]` 型であるため、複数の値によるフィルタリングが適切に機能します。
- `***` これらは UNIX タイムスタンプであるため、日付でフィルタリングするには、まず日付を UNIX タイムスタンプに変換する必要があります。参考になるサイト: `unixtimestamp.com`

## 例

`miku {duration: [60..120]} {private: false} {tags: [mikumiku dance]}` は、タイトルまたは説明に文字列 `miku` を含み、再生時間が1分から2分で、非公開で、`mikumikudance` タグが付けられたコンテンツに一致します。

