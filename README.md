# quoridorn-server
Application server of the Quoridorn.

クライアント：quoridorn-mark2([GitHub](https://github.com/HillTopTRPG/quoridorn-mark2))

## Quoridornとは？
* [公式サイト](http://quoridorn.com)<br>
* 制作者：HillTop([Twitter](https://twitter.com/HillTop_TRPG))

## 構成物
* Node.js
* socket.io
* nekostore
* MongoDB

## スペシャルサンクス
* **nekostore**
  * 制作者：https://github.com/esnya
  * Repository：<https://github.com/esnya/nekostore>

## 使い方
使えるようにしておくべきコマンド
* git
* npm
* node
* mongo
* mongod

1. Quoridornサーバ本体の配置
   1. `git clone https://github.com/HillTopTRPG/quoridorn-server.git` GitHubからソースをダウンロード
   1. `cd quoridorn-server` 生成された「quoridorn-server」ディレクトリに移動
   1. `npm install` ライブラリをインストール
   1. `npm run build` TypeScriptをビルドすることで「dist」フォルダにJavaScriptファイルが生成される

1. MongoDBを起動 ※ MongoDBの構築は詳しくは解説しません。（できません）
   1. `mongo`
   1. 「***connection to: mongodb://127.0.0.1:27017/~~~~~~***」 と表示されたらOK<br>
      「***mongodb://***」からポート番号までの文字（例：***mongodb://127.0.0.1:27017***）をメモしておく
   1. エラーだったら構築に失敗してます。構築頑張って…🐧🌟

1. Quoridornサーバの設定を編集
   1. 「quoridorn-server/conf/server.yaml」を編集する（テキストエディタで編集可能）<br>
      書き方や注意点はyamlファイル内にコメントを書いてあるので、それを見ながら頑張って設定値を書いて欲しい<br>
      前項でメモしておいたMongoDBの接続文字列はこのファイルに設定する

1. Quoridornサーバを起動
   1. `npm run node-server` Node.jsサーバを起動
   1. 「***Quoridorn Server is Ready.***」と表示されたら構築完了🐧🎊
