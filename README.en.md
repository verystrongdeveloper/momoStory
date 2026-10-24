# MomoStory

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

> An unofficial fan project where conversations with Blue Archive characters lead into relationship stories.

[![Release](https://img.shields.io/github/v/release/verystrongdeveloper/momoAI?display_name=tag&label=release)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-5865F2)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020)](https://expo.dev/)

## Overview

<p align="center">
  <img src="docs/screenshots/character-chat.png" alt="MomoStory chat screen: talking with Hoshino and opening a relationship story" width="860" />
</p>

<p align="center"><sub>Character chat — start a relationship story once you have built up a conversation.</sub></p>

MomoStory offers one-on-one conversations shaped by each character's personality and speech style, followed by choice-based relationship stories built from the conversation. Backgrounds, character expressions, music, and sound effects bring the scenes to life.

<p align="center">
  <img src="docs/screenshots/bond-event.png" alt="MomoStory relationship story player showing Hoshino's expression and dialogue" width="860" />
</p>

<p align="center"><sub>Story player — scenes combine character expressions, backgrounds, and dialogue.</sub></p>

## Features

| Feature | Description |
| --- | --- |
| 💬 Character chat | Persona-based conversations with supported characters such as Hoshino, Hina, and Mari. |
| 🎬 Relationship stories | Generate and play scenes with dialogue choices based on your conversations. |
| 🎵 Multimedia effects | Character expressions, backgrounds, music, and sound effects. |
| 📚 Library | Save chats and stories, search by title or content, edit scripts, and create new ones. Each card is a chat room with story buttons between conversations. Keep chatting below each button and generate more stories. Edit the room title, chat messages and scripts. |
| 📹 Video export | Export saved chats followed by their stories as 16:9 or 9:16 MP4 videos. Choices advance automatically in exported videos. |
| 🌐 Languages | Korean (default), English, Japanese, and Simplified Chinese UI and new chat/story generation. Existing saved content is not automatically translated. |
| ⚙️ Settings | Adjust chat size, sound, language, and your API key. |

## Downloads

Get the latest Windows application and Android APK from [GitHub Releases](https://github.com/verystrongdeveloper/momoAI/releases/latest).

- **Windows**: the `MomoStory_*-setup.exe` installer or `MomoStory.exe`
- **Android**: `MomoStory.apk`

> Android may require permission to install apps from this source. Unsigned Windows builds may trigger a SmartScreen warning.

## Getting started

### Requirements

- Node.js 22.x, version 22.13.0 or later in that release line (matching release CI)
- npm
- Your own Gemini API key

### Install and run

```bash
git clone https://github.com/verystrongdeveloper/momoAI.git
cd momoAI
npm install
npx expo start
```

Choose a browser, Android emulator, or Expo Go to try the app. Enter your Gemini API key in **Settings** to start chatting.

Expo Go can preview some features, but native Android video saving requires a development build or the released APK. Windows builds require Rust and Windows C++ build tools. Android builds require JDK 17 or later and the Android SDK.

### Release builds

```bash
# Windows executable and installer
npm run desktop

# Signed Android APK
npm run android:apk
```

Android release builds require the environment variables for your private release signing key. Pushing a version tag (`v*`) triggers the GitHub Actions release workflow.

See the [release checklist](docs/RELEASE.md) for signing and publishing. Additional documentation: [video export](docs/video-export.md) and [generation language](docs/generation-language.md) (these two guides are currently in Korean).

## Project structure

```text
app/                 Expo Router screens
components/          Chat, story player, and layout UI
constants/           Character and multimedia asset mappings
hooks/               BGM, layout, and script processing
services/            AI requests, app settings, and video export
shared/prompts/      Shared chat and story generation prompts
storage/             Settings, API keys, and saved library content
server/              Express API (default route for web development)
src-tauri/           Windows desktop package
.github/workflows/   Windows and Android release automation
```

## Tech stack

- React Native · Expo · Expo Router · TypeScript
- Tauri · Rust (Windows desktop package)
- Gemini API
- GitHub Actions (Windows EXE / Android APK releases)

## Supported characters

The characters currently selectable in the chat screen are **Hoshino, Hina, and Mari**.

## Disclaimer and rights

MomoStory is an **unofficial, non-commercial fan project based on Blue Archive**. Blue Archive and its characters, images, music, and other related materials belong to their respective rights holders. This project is not affiliated with Nexon or Nexon Games. Commercial use is prohibited.
