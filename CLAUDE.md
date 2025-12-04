# Note Context Agent - LLM 开发指南

**说明**：本项目为个人使用项目，文档使用中文编写以便于理解和管理。

## 项目概述

这是一个混合项目，用于实现一个自定义的 AI Agent

#### 主要目标

- Agent 可以做到日常对话和当前纪要文档修改
- 除对话中指定的文件和自动保存的历史记录外，**其他文档必须仅由用户更改**
- 文档修正功能以 `tool_call` 形式提供，但是需要用户授权（类似 ACP 权限确认实现）
- 以 `tool_call` 的形式提供记忆文档、最近对话信息等功能

## 项目结构

```
note-context-agent/
├── note-agent/        # Agent 实现 + ACP 服务
│   ├── package.json   # `note-agent` 项目 `package.json`
│   └── CLAUDE.md      # `note-agent` LLM 开发指南
├── obsidian/          # Obsidian插件（迁移项目）
│   ├── package.json   # `obsidian` 项目 `package.json`
│   └── CLAUDE.md      # `obsidian` LLM 开发指南
├── docs/              # ACP 协议文档
├── package.json       # 项目 `package.json`
└── CLAUDE.md          # 项目 LLM 开发指南
```

- `obsidian` 项目直接依赖 `note-agent` 的自定义接口
- `note-agent` 会在自定义接口基础上再包装一层提供 ACP 服务

### 1. note-agent（核心 Agent 实现）

- **定位**：项目的核心实现，处理 AI 交互逻辑
- **双重功能**：
  1. **作为依赖库**：提供核心 Agent 功能，被 `obsidian` 项目直接调用
  2. **作为ACP服务器**：提供独立的 main 入口，提供符合 Agent Client Protocol 标准的 Agent 服务

### 2. obsidian（Obsidian插件）

- **原项目**：[RAIT-09/obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client)
- **集成方式**：
  - 直接使用 `note-agent` 的库功能，不通过 ACP 定义的 JSON RPC 进行交互
  - 采用直接集成的方式调用 `note-agent` 的核心处理逻辑

### 3. docs目录

- **内容**：ACP协议文档，供参考使用
- **重要说明**：
  - `note-agent` 项目使用 TypeScript 库 `@agentclientprotocol/sdk` 实现ACP协议
  - SDK 封装了 JSON RPC 通信细节，开发者无需处理底层解析
  - 该 SDK 仅在 `note-agent` 作为ACP服务器时使用，`obsidian` 插件直接调用库而不涉及 ACP 通信

## 开发环境

项目使用 `pnpm-workspace.yaml` 管理子项目依赖；
因此**项目必须使用 `pnpm` 命令**

### 1. 根目录项目

仅负责代码格式调整和管理依赖

- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check formatting without changing files

### 2. 子项目环境

子项目的具体环境和设置应该由子项目中的 `package.json` 和 `CLAUDE.md` 定义；
**所有子项目都可以独立运行，每个子项目的开发应该遵循其自己的配置和定义**
