# MomoStory

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

> 『ブルーアーカイブ』のキャラクターと会話し、その流れから絆ストーリーへつなげる非公式ファンプロジェクトです。

[![Release](https://img.shields.io/github/v/release/verystrongdeveloper/momoAI?display_name=tag&label=release)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-5865F2)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020)](https://expo.dev/)

## 概要

<p align="center">
  <img src="docs/screenshots/character-chat.png" alt="ホシノと会話し、絆ストーリーを開始できるMomoStoryのチャット画面" width="860" />
</p>

<p align="center"><sub>キャラクターチャット — 会話を重ねると、絆ストーリーを開始できます。</sub></p>

MomoStoryでは、キャラクターの口調や性格を反映した1対1の会話と、その会話をもとに展開する選択肢付きの絆ストーリーを楽しめます。背景・表情・BGM・効果音で、シーンの雰囲気も演出します。

<p align="center">
  <img src="docs/screenshots/bond-event.png" alt="ホシノの表情とセリフを表示するMomoStoryの絆ストーリープレイヤー" width="860" />
</p>

<p align="center"><sub>ストーリープレイヤー — キャラクターの表情、背景、セリフとともにシーンを再生します。</sub></p>

## 主な機能

| 機能 | 説明 |
| --- | --- |
| 💬 キャラクターチャット | ホシノやヒナなど、対応キャラクターのペルソナを反映した会話。 |
| 🎬 絆ストーリー | 会話の内容をもとに、選択肢付きのストーリーを生成・再生。 |
| 🎵 マルチメディア演出 | キャラクターの表情、背景画像、BGM、効果音。 |
| 📚 ライブラリ | チャットとストーリーの保存、タイトル／内容による検索、台本編集、新規作成。カードごとのルームで会話と絆ストーリーボタンが順に続きます。ボタンの下で会話を続け、ルーム名・会話・各台本を編集できます。 |
| 📹 動画の書き出し | 保存したチャットとストーリーを、16:9または9:16のMP4動画として連続で書き出し。動画内の選択肢は自動で進みます。 |
| 🌐 多言語対応 | 韓国語（初期設定）・英語・日本語・簡体字中国語のUIと、新規チャット／ストーリー生成。保存済みの内容は自動翻訳されません。 |
| ⚙️ 個人設定 | チャットの大きさ、音量、言語、APIキーを設定。 |

## ダウンロード

最新のWindowsアプリとAndroid APKは、[GitHub Releases](https://github.com/verystrongdeveloper/momoAI/releases/latest)からダウンロードできます。

- **Windows**：インストーラー `MomoStory_*-setup.exe` または `MomoStory.exe`
- **Android**：`MomoStory.apk`

> Androidでは、この提供元からのアプリのインストール許可が必要になる場合があります。未署名のWindowsビルドでは、SmartScreenの警告が表示される場合があります。

## はじめに

### 必要なもの

- Node.js 22.x（22.13.0以上。リリースCIと同じメジャーバージョン）
- npm
- ご自身のGemini APIキー

### インストールと起動

```bash
git clone https://github.com/verystrongdeveloper/momoAI.git
cd momoAI
npm install
npx expo start
```

ブラウザー、Androidエミュレーター、Expo Goから実行環境を選べます。起動後、**設定**にご自身のGemini APIキーを入力すると会話を開始できます。

Expo Goでは一部の機能を確認できますが、Androidのネイティブ動画保存には開発ビルドまたは配布APKが必要です。WindowsビルドにはRustとWindows C++ビルドツール、AndroidビルドにはJDK 17以上とAndroid SDKが必要です。

### 配布用ビルド

```bash
# Windows実行ファイルとインストーラー
npm run desktop

# 署名付きAndroid APK
npm run android:apk
```

Androidのリリースビルドには、ご自身のリリース署名キーに関する環境変数が必要です。バージョンタグ（`v*`）をプッシュすると、GitHub Actionsがリリース処理を実行します。

署名・配布の手順は[リリースチェックリスト](docs/RELEASE.md)（英語）をご覧ください。[動画書き出し](docs/video-export.md)と[生成言語](docs/generation-language.md)の詳しい説明は、現在韓国語で提供しています。

## プロジェクト構成

```text
app/                 Expo Routerの画面
components/          チャット・ストーリープレイヤー・レイアウトUI
constants/           キャラクターとマルチメディア素材の対応表
hooks/               BGM・レイアウト・台本処理
services/            AI通信・アプリ設定・動画書き出し
shared/prompts/      チャットとストーリー生成の共通プロンプト
storage/             設定・APIキー・ライブラリの保存
server/              Express API（Web開発時の既定経路）
src-tauri/           Windowsデスクトップパッケージ
.github/workflows/   Windows・Androidリリースの自動化
```

## 使用技術

- React Native · Expo · Expo Router · TypeScript
- Tauri · Rust（Windowsデスクトップパッケージ）
- Gemini API
- GitHub Actions（Windows EXE / Android APKのリリース）

## 対応キャラクター

現在、チャット画面で選択できるキャラクターは**ホシノとヒナ**です。

## 注意事項・権利について

MomoStoryは、**『ブルーアーカイブ』を題材とした非公式・非営利の二次創作ファンプロジェクト**です。『ブルーアーカイブ』および関連するキャラクター・画像・音楽などの権利は、それぞれの権利者に帰属します。本プロジェクトは、ネクソンおよびネクソンゲームズとは関係ありません。商用利用を禁止します。
