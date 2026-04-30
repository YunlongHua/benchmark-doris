# Doris Benchmark
中文 | [English](README_EN.md)

基于 Electron + React + TypeScript + Ant Design 构建的桌面应用，用于在 [Apache Doris](https://doris.apache.org) 集群上运行数据库基准测试（SSB、TPC-H、TPC-DS）并生成 HTML 性能报告。

## 功能特性

- **集群管理** — 添加、编辑、删除 Doris 集群配置（含 SSH 凭证）
- **一键基准测试** — 自动执行全部 5 个步骤（编译、生成数据、建表、加载数据、运行查询）
- **分步执行** — 可单独运行每个基准测试步骤，支持环境状态检查
- **实时日志** — 在内置终端中实时查看远程脚本输出
- **HTML 报告** — 生成包含图表（冷热耗时、性能趋势、缓存提升）、评分和查询明细表的报告
- **SSB Flat 表支持** — 报告中使用页签切换普通表和 Flat 表结果
- **主题与语言** — 支持亮色/暗色主题和中英文切换

## 支持的基准测试

| 基准测试 | 查询数 | 说明 |
|---------|--------|------|
| **SSB** | 13 | 星型模型基准测试 — OLAP 星型模式查询 |
| **TPC-H** | 22 | 决策支持 / 商业智能基准测试 |
| **TPC-DS** | 99 | 复杂分析查询基准测试 |

支持规模因子：1、10、100、500、1000

## 架构概览

整个系统涉及三部分：

```
┌─────────────────────────────────────────────────────────────────┐
│                      执行机器 (Windows)                         │
│                                                                 │
│   ┌──────────────────────────────────────┐                      │
│   │        Doris Benchmark.exe           │                      │
│   │    (Electron + React 桌面应用)        │                      │
│   └────────────┬─────────────────────────┘                      │
│                │   SSH (端口 22)                                │
│                │   上传脚本 · 下发命令 · 回传日志               │
└────────────────┼────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────┴────────────────────────────────────────────────┐
│                      压测机 (Linux)                             │
│                                                                 │
│   ┌──────────────────────────────────────┐                      │
│   │         基准测试工具集                │                      │
│   │   dbgen · 建表脚本 · 查询脚本         │                      │
│   │   gcc/g++/make · MySQL 客户端        │                      │
│   └────────────┬─────────────────────────┘                      │
│                │   MySQL (9030) + HTTP (8030/8040)              │
│                │   建表 · 导入数据 · 执行查询                   │
└────────────────┼────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────┴────────────────────────────────────────────────┐
│                    Doris 集群 (Linux)                           │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│   │  FE 节点  │  │  FE 节点  │  │  FE 节点  │   ···             │
│   └──────────┘  └──────────┘  └──────────┘                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│   │  BE 节点  │  │  BE 节点  │  │  BE 节点  │   ···             │
│   └──────────┘  └──────────┘  └──────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**三部分说明：**

| 角色 | 操作系统 | 说明 |
|------|---------|------|
| **执行机器** | Windows | 运行 `Doris Benchmark.exe` 的 PC。负责提供操作界面，通过 SSH 远程控制压测机执行基准测试。 |
| **压测机** | Linux | 实际执行基准测试的服务器。接收执行机器下发的脚本和命令，在本地完成编译、数据生成、数据加载和查询执行。压测机需要能通过网络访问 Doris 集群。 |
| **Doris 集群** | Linux | 被测试的 Apache Doris 数据库集群，包含 FE（Frontend）和 BE（Backend）节点。 |

> **常见部署方式**：压测机可以与 Doris 集群部署在同一台机器上（适用于单节点测试），也可以独立部署（适用于生产集群压测）。当 Doris 集群包含多个节点时，压测机通常部署在其中一台 FE 节点上，通过 `localhost` 访问 Doris 服务。

## 环境要求

### 执行机器（本地 Windows PC）

- **操作系统**：Windows 10+（主要目标平台；macOS/Linux 未经充分测试）
- 无需额外安装运行时环境，`Doris Benchmark.exe` 为独立打包的可执行文件

### 压测机（远程 Linux 服务器）

- **操作系统**：Linux（需有 Bash）
- **SSH 服务**：开启 SSH 服务（端口 22），支持密码认证
- **编译工具**：`gcc`、`g++`、`make`（编译 dbgen 等数据生成工具）
- **系统工具**：`unzip`（解压工具包）、`curl`（调用 Doris HTTP API）
- **MySQL 客户端**：用于通过 Stream Load 导入数据到 Doris

### Doris 集群

- Apache Doris 集群已部署并正常运行
- FE 服务端口可达：
  - **FE HTTP 端口**（默认 `8030`，实际端口取决于集群配置，常见默认值为 29980）
  - **FE HTTPS 端口**（默认 `8040`，实际端口取决于集群配置，常见默认值为 29991）
  - **FE MySQL 查询端口**（默认 `9030`，实际端口取决于集群配置，常见默认值为 29982）

### 网络连通性

```
执行机器 ──SSH(22)──▶ 压测机 ──MySQL(9030)/HTTP(8030)──▶ Doris 集群
```

- **执行机器 → 压测机**：仅需 SSH（端口 22）连通
- **压测机 → Doris 集群**：需能访问 FE 的 HTTP/HTTPS 端口和 MySQL 查询端口
- 如果压测机就是 Doris 节点，压测机通过 `localhost` 访问 Doris 即可

## 快速开始

1. 从 [Releases](https://github.com/YunlongHua/benchmark-doris/releases) 下载最新的 `Doris-Benchmark-win-x64.zip` 并解压。

2. 运行 `Doris Benchmark.exe`。

3. 添加集群（点击 "+" 按钮），填写：
   - **Name**：集群名称（自定义）
   - **FE Host**：Doris FE 的 IP 或主机名
   - **FE HTTP Port**：`8030`（或实际配置的端口）
   - **FE HTTPS Port**：`8040`（或实际配置的端口）
   - **FE Query Port**：`9030`（MySQL 协议端口）
   - **User / Password**：Doris 登录凭证（默认 `root` / 无密码）
   - **SSH Host / Port / User / Password**：远程服务器 SSH 凭证

4. 从下拉菜单选择集群 — 绿色圆点表示连接成功。

5. 选择基准测试类型（SSB/TPCH/TPCDS）和规模因子。

6. 点击 **上传工具**，将基准测试脚本推送到远程服务器。

7. 点击 **检查**，验证环境状态。

8. 点击 **运行所有** 执行完整基准测试，或依次点击各步骤按钮（编译 → 生成数据 → 建表 → 加载数据 → 运行查询）。

9. 测试完成后，点击 **生成报告** 保存 HTML 报告。

## 测试步骤

| 步骤 | 说明 |
|------|------|
| 1. 编译 | 编译基准测试数据生成工具 (dbgen) |
| 2. 生成数据 | 运行生成器产出 `.tbl` 数据文件 |
| 3. 建表 | 在 Doris 中创建基准测试数据库表 |
| 4. 加载数据 | 将生成的数据加载到 Doris 表中 |
| 5. 运行查询 | 执行基准测试查询并收集耗时结果 |

## 开发指南

```bash
# 克隆仓库
git clone https://github.com/YunlongHua/benchmark-doris.git
cd benchmark-doris

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 生产构建
npm run build

# 打包为 Windows 应用
npm run package
```

打包后的应用输出到 `dist/win-unpacked/` 目录。

## 项目结构

```
doris/
├── electron/              # Electron 主进程
│   ├── ipc/               # IPC 处理器和服务
│   │   ├── handlers.ts    # IPC 通道处理器
│   │   ├── scriptRunner.ts # 通过 SSH 远程执行脚本
│   │   ├── configStore.ts # 集群配置持久化
│   │   ├── resultParser.ts # 基准测试输出解析
│   │   └── reportGenerator.ts # HTML 报告生成
│   ├── services/          # 后端服务
│   │   ├── mysql.ts       # MySQL 查询服务
│   │   └── ssh.ts         # SSH 连接服务
│   ├── main.ts            # Electron 主入口
│   └── preload.ts         # 预加载脚本 (IPC 桥接)
├── src/                   # React 渲染进程
│   ├── components/        # UI 组件
│   │   ├── TestPanel.tsx  # 主控制面板
│   │   ├── SQLTerminal.tsx # SQL 查询终端
│   │   ├── LogPanel.tsx   # 日志输出面板
│   │   ├── ClusterModal.tsx # 集群编辑弹窗
│   │   └── ClusterPanel.tsx # 集群管理
│   ├── stores/            # Zustand 状态管理
│   ├── hooks/             # 自定义 React Hooks
│   ├── types/             # TypeScript 类型定义
│   └── i18n.ts            # 国际化
├── tools/                 # 基准测试脚本
│   ├── ssb-tools/         # SSB 基准测试工具
│   ├── tpch-tools/        # TPC-H 基准测试工具
│   └── tpcds-tools/       # TPC-DS 基准测试工具
├── electron-builder.yml   # Electron Builder 配置
├── vite.config.ts         # Vite 构建配置
└── package.json           # 依赖与脚本
```

## 许可证

Apache License 2.0
