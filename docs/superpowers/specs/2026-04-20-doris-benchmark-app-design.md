# Doris Benchmark 桌面客户端 — 设计文档

## 1. 概述

**项目名称：** Doris Benchmark Tool (doris-benchmark-app)
**项目类型：** Electron 桌面客户端
**核心功能：** 通过可视化界面运行 Apache Doris 的 SSB/TPCH/TPCDS 基准测试，管理集群配置、查看实时日志、分析测试结果
**目标用户：** DBA、数据库性能工程师

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 桌面框架 | Electron 28+ | Chromium + Node.js 运行时 |
| 前端框架 | React 18 + TypeScript | 函数式组件 + Hooks |
| UI 组件库 | Ant Design 5 | 企业级 React 组件库 |
| 状态管理 | Zustand | 轻量级全局状态 |
| 图表库 | ECharts | 测试结果可视化 |
| 构建工具 | Vite + electron-builder | 快速构建 + 打包 |
| 主进程服务 | Node.js (child_process) | 执行 Shell 脚本、配置管理 |

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Renderer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Header     │  │  ClusterCfg   │  │  SQLTerm     │ │
│  │  (Nav + Tab) │  │   Panel       │  │   Panel      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Main Content Area                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │   │
│  │  │ Test Type  │  │  Progress  │  │  Result   │  │   │
│  │  │  Selector   │  │   Steps    │  │   Chart   │  │   │
│  │  └────────────┘  └────────────┘  └───────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Log Output Panel                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │ IPC
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ ScriptRunner │  │ ConfigStore  │  │ ResultParser │ │
│  │ (child_proc) │  │  (YAML/JSON) │  │  (stdout)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │  MySQL CLI   │  │     doris-benchmark-app/data    │ │
│  │  (mysql cmd) │  │  ├─ clusters/                   │ │
│  └──────────────┘  │  ├─ results/                    │ │
│                    │  └─ tools/ (ssb|tpch|tpcds)     │ │
│                    └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 项目目录结构

```
doris-benchmark-app/
├── electron/
│   ├── main.ts              # Electron 主进程入口
│   ├── preload.ts           # 预加载脚本 (IPC 桥接)
│   ├── ipc/                  # IPC 处理模块
│   │   ├── scriptRunner.ts  # Shell 脚本执行器
│   │   ├── configStore.ts   # 集群配置读写
│   │   └── resultParser.ts  # 日志/结果解析
│   └── services/
│       └── mysql.ts         # MySQL CLI 封装
├── src/
│   ├── main.tsx             # React 入口
│   ├── App.tsx              # 根组件
│   ├── components/
│   │   ├── Header.tsx       # 顶部导航 + 测试类型切换
│   │   ├── ClusterPanel.tsx # 集群配置管理面板
│   │   ├── TestPanel.tsx    # 测试步骤控制 + 进度显示
│   │   ├── LogPanel.tsx     # 实时日志输出面板
│   │   ├── ResultChart.tsx  # ECharts 结果图表
│   │   ├── ResultTable.tsx  # 查询结果表格
│   │   └── SQLTerminal.tsx  # 手动 SQL 执行窗口
│   ├── stores/
│   │   ├── clusterStore.ts  # 集群配置状态
│   │   ├── testStore.ts     # 测试状态 (进行中/完成/错误)
│   │   └── logStore.ts      # 日志状态
│   └── types/
│       └── index.ts         # TypeScript 类型定义
├── tools/                    # 从 Doris 仓库下载的测试工具
│   ├── ssb-tools/
│   ├── tpch-tools/
│   └── tpcds-tools/
├── data/                     # 用户数据 (Electron appData)
│   ├── clusters/            # 集群配置文件 (*.yaml)
│   └── results/             # 测试结果 JSON
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json
```

---

## 4. 功能模块设计

### 4.1 测试类型切换

- 顶部 Tab 栏：SSB | TPCH | TPCDS
- 切换时自动加载对应工具的配置（bin 脚本路径、查询 SQL 路径、ddl 路径）
- 当前选中的 Tab 高亮显示

### 4.2 集群配置管理

- **配置列表：** 显示所有已保存的集群（名称、FE_HOST、创建时间）
- **新增配置：** 表单填写 FE_HOST、FE_HTTP_PORT、FE_QUERY_PORT、USER、PASSWORD
- **选择/编辑/删除** 配置
- **配置文件格式：** YAML，存储在 `data/clusters/*.yaml`
- 启动时自动读取上次使用的配置

### 4.3 测试步骤控制

每个基准测试分 5 个步骤（与官方工具一致）：

| 步骤 | 说明 | 脚本 |
|------|------|------|
| 1 | 构建数据生成器 | `build-*.sh` |
| 2 | 生成测试数据 | `gen-*-data.sh -s <scale>` |
| 3 | 创建 Doris 表 | `create-*-tables.sh -s <scale>` |
| 4 | 导入数据 | `load-*-data.sh` |
| 5 | 执行查询 | `run-*-queries.sh -s <scale>` |

**一键模式：** 自动按顺序执行所有步骤
**分步模式：** 每个步骤独立按钮，可单独运行或跳过

**Scale Factor：** 预设下拉框 (1, 10, 100, 500, 1000) + 自定义输入框

### 4.4 日志面板

- 实时显示脚本 stdout/stderr（类似终端输出，颜色区分）
- 可折叠/展开
- 支持滚动到底部
- 支持清空日志
- 错误行高亮红色

### 4.5 结果展示

- **查询结果表格：** 显示每条 SQL 的执行时间、总耗时
- **导出按钮：** 导出为 JSON 文件（用户选择路径）
- **ECharts 柱状图：** 每条查询的耗时对比，一目了然

### 4.6 SQL 终端（调试功能）

- 可直接在界面输入 SQL，通过 `mysql` CLI 发送到 Doris
- 支持执行任意 SQL 查询
- 结果以表格展示
- 用于验证集群连接或手动调试

### 4.7 日志级别控制

- 可切换日志详细程度：Info / Verbose / Debug
- Verbose 模式下显示更详细的中间步骤信息

---

## 5. 数据流

### 5.1 测试执行流程

```
用户点击"开始测试"
    ↓
Renderer 发送 IPC: 'test:start' (testType, clusterConfig, scale)
    ↓
Main Process: ScriptRunner
    ↓
1. 调用 build-*.sh 构建数据生成器
    ↓
Log → IPC: 'log:update' → Renderer 显示实时日志
    ↓
2. 调用 gen-*-data.sh -s <scale> 生成数据
    ↓
Log → IPC: 'log:update'
    ↓
3. 调用 create-*-tables.sh 创建表
    ↓
Log → IPC: 'log:update'
    ↓
4. 调用 load-*-data.sh 导入数据
    ↓
Log → IPC: 'log:update'
    ↓
5. 调用 run-*-queries.sh 执行查询
    ↓
Result JSON → IPC: 'result:update' → Renderer 解析并展示
    ↓
完成后保存结果到 data/results/<timestamp>.json
```

### 5.2 集群配置数据流

```
用户编辑/新增配置
    ↓
Renderer 发送 IPC: 'config:save' (clusterData)
    ↓
Main Process: ConfigStore
    ↓
写入 data/clusters/<name>.yaml
    ↓
确认保存成功 → 更新 Renderer 状态
```

---

## 6. IPC 通信协议

| Channel | 方向 | Payload | 说明 |
|---------|------|---------|------|
| `test:start` | Renderer → Main | `{testType, scale, clusterId}` | 开始测试 |
| `test:stop` | Renderer → Main | `{}` | 终止测试 |
| `test:step` | Renderer → Main | `{step: 1-5}` | 执行单个步骤 |
| `log:update` | Main → Renderer | `{line: string, level: 'info'|'error'}` | 日志更新 |
| `result:update` | Main → Renderer | `{queries: QueryResult[]}` | 查询结果 |
| `result:export` | Renderer → Main | `{path: string}` | 导出结果 |
| `config:list` | Renderer → Main | `{}` | 获取配置列表 |
| `config:save` | Renderer → Main | `ClusterConfig` | 保存配置 |
| `config:delete` | Renderer → Main | `{name: string}` | 删除配置 |
| `sql:execute` | Renderer → Main | `{sql: string}` | 执行 SQL |
| `sql:result` | Main → Renderer | `{rows: [], columns: []}` | SQL 结果 |

---

## 7. 集群配置数据结构

```typescript
interface ClusterConfig {
  name: string;          // 配置名称（如 "测试集群1"）
  feHost: string;        // FE 主机 IP
  feHttpPort: number;    // FE HTTP 端口 (默认 8030)
  feQueryPort: number;   // FE Query 端口 (默认 9030)
  user: string;          // 数据库用户 (默认 root)
  password: string;      // 数据库密码
  createdAt: string;     // 创建时间 ISO 格式
}
```

---

## 8. 测试结果数据结构

```typescript
interface TestResult {
  testType: 'ssb' | 'tpch' | 'tpcds';
  scale: number;
  clusterName: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  queries: QueryResult[];
}

interface QueryResult {
  queryId: string;       // 如 "q1.1", "q2.1"
  sql: string;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
}
```

---

## 9. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 集群连接失败 | 弹窗提示 "无法连接到 Doris"，显示具体错误信息 |
| 脚本执行失败 | 在日志中高亮错误行，测试状态标记为失败，可重试 |
| MySQL CLI 未安装 | 启动检测，提示安装 mysql 客户端 |
| 结果解析失败 | 保留原始日志，提示解析失败，可手动查看日志 |
| 磁盘空间不足 | 在生成数据前检测，警告用户 |

---

## 10. Windows 兼容性方案

Shell 脚本在 Windows 下运行需要解决兼容性问题。

**方案选择：Git Bash 作为默认 Shell**

- Electron `child_process.spawn` 使用 `bash.exe`（Git for Windows 自带）执行脚本
- `shell: true` + `executable: 'bash'` 指定使用 Git Bash
- 脚本中的 `#!/bin/bash` 替换为 `#!/usr/bin/env bash` 以兼容 Git Bash
- Windows 下 `mysql` 客户端需用户自行安装并加入 PATH
- 启动时检测 `bash.exe` 和 `mysql.exe` 是否可用，不可用则提示安装

---

## 11. 待明确事项

- [x] ~~跨平台兼容~~ → 确认为 Windows 主运行环境，采用 Git Bash 方案
- [ ] 是否需要支持测试历史对比（多次测试结果趋势图）？
- [ ] 是否需要用户认证功能（多用户配置隔离）？

---

## 11. 后续步骤

1. 用户确认本设计文档
2. 启动 `writing-plans` 技能生成详细实现计划
3. 依次实现各个模块
