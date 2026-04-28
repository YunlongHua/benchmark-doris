# Doris Benchmark

A desktop application for running database benchmarks (SSB, TPCH, TPCDS) against [Apache Doris](https://doris.apache.org) clusters and generating HTML performance reports.

Built with Electron + React + TypeScript + Ant Design.

[中文文档](README.md)

## Features

- **Cluster Management** — Add, edit, delete Doris cluster configurations with SSH credentials
- **One-click Benchmark** — Run all 5 steps (build, generate data, create tables, load data, run queries) automatically
- **Step-by-step Execution** — Run individual benchmark steps and check environment status
- **Real-time Logs** — View streaming remote script output in the built-in terminal
- **HTML Reports** — Generate styled reports with charts (bar, line, volatility), performance scores, and query detail tables
- **SSB Flat Table Support** — Tab-based report switching between regular and flat table results
- **Theme & Language** — Light/Dark theme and Chinese/English language toggle

## Supported Benchmarks

| Benchmark | Queries | Description |
|-----------|---------|-------------|
| **SSB** | 13 | Star Schema Benchmark — OLAP star schema queries |
| **TPC-H** | 22 | Decision support / business intelligence benchmark |
| **TPC-DS** | 99 | Complex analytical query benchmark |

Scale factors: 1, 10, 100, 500, 1000

## Prerequisites

### Local Machine

- **Node.js** 18+
- **npm** 9+
- **Windows** (primary target; macOS/Linux untested but may work)

### Remote Server (where Doris runs)

- **Linux** with Bash
- **SSH** server accessible by password authentication
- **Doris** cluster with FE HTTP port (default: `8030`), HTTPS port (default: `8040`), and MySQL query port (default: `9030`) accessible from the remote server
- **Build dependencies** for benchmark tools:
  - `gcc`, `g++`, `make` (for compiling dbgen/tools)
  - `unzip` (for extracting tool archives)
  - `curl` (for interacting with Doris HTTP API)
- **MySQL client** installed on the remote server (for loading data via streaming load)

### Network

- The **local machine** only needs to reach the remote server via **SSH** (port 22)
- The **remote server** must be able to reach the Doris FE HTTP/MySQL ports on `localhost`

## Quick Start

1. Download the latest `Doris-Benchmark-win-x64.zip` from [Releases](https://github.com/YunlongHua/benchmark-doris/releases) and unzip.

2. Run `Doris Benchmark.exe`.

3. Add a cluster (click the "+" button) with:
   - **Name**: any label
   - **FE Host**: Doris FE IP or hostname
   - **FE HTTP Port**: `8030` (or your configured port)
   - **FE HTTPS Port**: `8040` (or your configured port)
   - **FE Query Port**: `9030` (MySQL protocol port)
   - **User / Password**: Doris credentials (default: `root` / no password)
   - **SSH Host / Port / User / Password**: remote server SSH credentials

4. Select the cluster from the dropdown — a green dot confirms connection.

5. Choose a benchmark type (SSB/TPCH/TPCDS) and scale factor.

6. Click **Upload** to push benchmark scripts to the remote server.

7. Click **Check** to verify the environment status.

8. Click **Run All** to execute the full benchmark, or click individual step buttons (Build → Generate Data → Create Tables → Load Data → Run Queries).

9. When the benchmark completes, click **Generate Report** to save an HTML report.

## Benchmark Steps

| Step | Description |
|------|-------------|
| 1. Build | Compile the benchmark data generator tool (dbgen) |
| 2. Generate Data | Run the generator to produce `.tbl` data files |
| 3. Create Tables | Create the benchmark database schema in Doris |
| 4. Load Data | Load generated data into Doris tables |
| 5. Run Queries | Execute benchmark queries and collect timing results |

## Development

```bash
# Clone the repository
git clone https://github.com/YunlongHua/benchmark-doris.git
cd benchmark-doris

# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build

# Package as Windows app
npm run package
```

The packaged app is output to `dist/win-unpacked/`.

## Project Structure

```
doris/
├── electron/              # Electron main process
│   ├── ipc/               # IPC handlers and services
│   │   ├── handlers.ts    # IPC channel handlers
│   │   ├── scriptRunner.ts # Remote script execution via SSH
│   │   ├── configStore.ts # Cluster config persistence
│   │   ├── resultParser.ts # Benchmark output parser
│   │   └── reportGenerator.ts # HTML report builder
│   ├── services/          # Backend services
│   │   ├── mysql.ts       # MySQL query service
│   │   └── ssh.ts         # SSH connection service
│   ├── main.ts            # Electron main entry
│   └── preload.ts         # Context bridge (IPC API)
├── src/                   # React renderer
│   ├── components/        # UI components
│   │   ├── TestPanel.tsx  # Main control panel
│   │   ├── SQLTerminal.tsx # SQL query terminal
│   │   ├── LogPanel.tsx   # Log output viewer
│   │   ├── ClusterModal.tsx # Cluster edit modal
│   │   └── ClusterPanel.tsx # Cluster management
│   ├── stores/            # Zustand state stores
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   └── i18n.ts            # Internationalization
├── tools/                 # Benchmark shell scripts
│   ├── ssb-tools/         # SSB benchmark tools
│   ├── tpch-tools/        # TPC-H benchmark tools
│   └── tpcds-tools/       # TPC-DS benchmark tools
├── electron-builder.yml   # Electron Builder config
├── vite.config.ts         # Vite build config
└── package.json           # Dependencies and scripts
```

## License

Apache License 2.0
