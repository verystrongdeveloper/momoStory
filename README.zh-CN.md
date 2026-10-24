# MomoStory

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

> 与《蔚蓝档案》角色聊天，并将对话延续为羁绊剧情的非官方同人项目。

[![Release](https://img.shields.io/github/v/release/verystrongdeveloper/momoAI?display_name=tag&label=release)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-5865F2)](https://github.com/verystrongdeveloper/momoAI/releases/latest)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-000020)](https://expo.dev/)

## 项目概览

<p align="center">
  <img src="docs/screenshots/character-chat.png" alt="MomoStory聊天界面：与星野交谈并开启羁绊剧情" width="860" />
</p>

<p align="center"><sub>角色聊天——积累对话后，即可开启羁绊剧情。</sub></p>

MomoStory提供符合角色语气与性格的一对一聊天，以及根据对话内容展开、带有选项的羁绊剧情。背景、角色表情、BGM和音效共同营造场景氛围。

<p align="center">
  <img src="docs/screenshots/bond-event.png" alt="MomoStory羁绊剧情播放器，显示星野的表情和台词" width="860" />
</p>

<p align="center"><sub>剧情播放器——结合角色表情、背景与台词呈现场景。</sub></p>

## 主要功能

| 功能 | 说明 |
| --- | --- |
| 💬 角色聊天 | 与星野、日奈等受支持角色进行符合人设的对话。 |
| 🎬 羁绊剧情 | 根据聊天内容生成并播放带有选项的剧情。 |
| 🎵 多媒体演出 | 支持角色表情、背景图片、BGM和音效。 |
| 📚 资料库 | 保存聊天与剧情，按标题或内容搜索，编辑脚本或新建脚本。每张卡片都是独立聊天室，羁绊故事按钮显示在对话之间，后续聊天在按钮下方继续。可编辑房间名称、对话和各故事的剧本。 |
| 📹 视频导出 | 将已保存的聊天和剧情连续导出为16:9或9:16的MP4视频，视频中的选项会自动推进。 |
| 🌐 多语言 | 支持韩语（默认）、英语、日语及简体中文界面，并按所选语言生成新的聊天与剧情。已有存档不会自动翻译。 |
| ⚙️ 个性化设置 | 调整聊天大小、音量、语言和API密钥。 |

## 下载

请前往[GitHub Releases](https://github.com/verystrongdeveloper/momoAI/releases/latest)下载最新的Windows程序和Android APK。

- **Windows**：安装程序 `MomoStory_*-setup.exe` 或 `MomoStory.exe`
- **Android**：`MomoStory.apk`

> Android可能需要允许安装来自此来源的应用。未签名的Windows版本可能触发SmartScreen警告。

## 开始使用

### 环境要求

- Node.js 22.x（22.13.0或更高的22.x版本，与发布CI使用的主版本一致）
- npm
- 您自己的Gemini API密钥

### 安装与运行

```bash
git clone https://github.com/verystrongdeveloper/momoAI.git
cd momoAI
npm install
npx expo start
```

可选择浏览器、Android模拟器或Expo Go运行。打开应用后，在**设置**中输入您自己的Gemini API密钥即可开始聊天。

Expo Go可用于预览部分功能，但Android原生视频保存需要开发构建或正式发布的APK。构建Windows版本需要Rust及Windows C++构建工具；构建Android版本需要JDK 17或更高版本及Android SDK。

### 发布构建

```bash
# Windows可执行程序和安装程序
npm run desktop

# 已签名的Android APK
npm run android:apk
```

Android发布构建需要配置您自己的发布签名密钥环境变量。推送版本标签（`v*`）后，GitHub Actions会自动执行发布流程。

签名与发布步骤请参阅[发布检查清单](docs/RELEASE.md)（英语）。[视频导出](docs/video-export.md)和[生成语言](docs/generation-language.md)的详细文档目前以韩语提供。

## 项目结构

```text
app/                 Expo Router页面
components/          聊天、剧情播放器与布局界面
constants/           角色及多媒体资源映射
hooks/               BGM、布局与脚本处理
services/            AI请求、应用设置与视频导出
shared/prompts/      聊天和剧情生成的共用提示词
storage/             设置、API密钥及资料库存储
server/              Express API（Web开发的默认调用路径）
src-tauri/           Windows桌面程序
.github/workflows/   Windows与Android自动发布流程
```

## 技术栈

- React Native · Expo · Expo Router · TypeScript
- Tauri · Rust（Windows桌面程序）
- Gemini API
- GitHub Actions（Windows EXE / Android APK发布）

## 支持的角色

目前可在聊天界面选择的角色为**星野和日奈**。

## 声明与权利

MomoStory是**基于《蔚蓝档案》的非官方、非营利同人二次创作项目**。《蔚蓝档案》及相关角色、图片、音乐等内容的权利归各自权利人所有。本项目与Nexon或Nexon Games不存在关联。禁止商业使用。
