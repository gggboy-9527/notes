# B. 多进程并行计算（充分利用多核 CPU）

下面开始第一条演示。

------

# 1. 使用 child_process.fork 执行 CPU 密集计算（比如斐波那契）

### 文件 1：`master.js`（主进程）

```
// master.js

const { fork } = require('child_process');

console.log(`主进程 PID: ${process.pid}`);

const worker = fork('./worker.js');

// 发送任务给 worker 子进程
worker.send({ num: 42 });

// 接收子进程返回的计算结果
worker.on('message', (msg) => {
  console.log(`子进程结果返回：${msg.result}`);
  worker.kill(); // 主动关闭子进程
});
```

------

### 文件 2：`worker.js`（子进程）

```
// worker.js

// 计算斐波那契（一个 CPU 密集任务）
function fib(n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}

process.on('message', (msg) => {
  const result = fib(msg.num);
  process.send({ result });
});
```

------

## 如何测试

1. 在 VS Code 新建两个文件：
   - master.js
   - worker.js
2. 终端执行：

```
node master.js
```

1. 打开任务管理器 / htop（Mac/Linux）：

你会看到：

- master.js 是一个 node 进程
- worker.js 是一个 node 进程
- 两个 CPU 核心**同时工作**

1. 输出示例：

```
主进程 PID: 12345
子进程结果返回：267914296
```

------

## 你将看到的效果（核心逻辑）

- **主进程不会被 CPU 计算阻塞**（因为运算在子进程执行）
- **子进程用你的 CPU 另一个核心跑 heavy CPU 任务**
- 完全符合“多进程并行计算”的典型模式

------

# 2. 使用 cluster 模块开启多核 Node.js 服务

Node.js 默认是**单线程**，即使是 32 核 CPU 也只用到一个核心。

Cluster 让你在每个 CPU 核心上启动一个 Node.js 进程，实现真正意义的多核服务。

------

## 示例：cluster 多核 HTTP 服务

### 文件：`cluster_server.js`

```
// cluster_server.js

const cluster = require('cluster');
const http = require('http');
const os = require('os');

if (cluster.isMaster) {
  console.log(`主进程 PID: ${process.pid}`);
  const cpuCount = os.cpus().length;
  console.log(`你的 CPU 核心数：${cpuCount}`);

  // 根据 CPU 核数创建 worker
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  // worker 崩溃自动重启
  cluster.on('exit', (worker) => {
    console.log(`子进程 ${worker.process.pid} 崩溃，正在重启...`);
    cluster.fork();
  });

} else {
  // Worker 子进程：负责真正处理 HTTP 请求
  http.createServer((req, res) => {
    res.end(`Handled by worker ${process.pid}`);
  }).listen(3000);

  console.log(`子进程 PID: ${process.pid} 已启动`);
}
```

------

## 如何测试

1. 创建 `cluster_server.js`
2. 运行：

```
node cluster_server.js
```

1. 输出示例：

```
主进程 PID: 3456
你的 CPU 核心数：8
子进程 PID: 4500 已启动
子进程 PID: 4501 已启动
子进程 PID: 4502 已启动
...
```

1. 访问：

```
http://localhost:3000
```

你会看到页面输出：

```
Handled by worker 4501
```

不断刷新，你会看到不同的 worker PID，这说明：

- 请求被不同的 CPU 核心处理
- Node.js 变成真正的多核 Web 服务器（类似 Nginx Worker）

------

## 你将看到的效果（核心逻辑）

- 主进程只负责管理 worker，不处理请求
- 每个 worker 是一个独立 node 进程
- 每个进程跑在不同 CPU 核上
- worker 崩溃后自动重启

这正是企业级 Node.js 高并发服务常见架构。

------

# 3.关于cluster

**一、cluster 的核心定位**

**cluster 不是用来自动并行 CPU 密集型计算的**，而是为了解决 **Node.js 单线程处理 HTTP 请求的瓶颈问题**。

### 背景

- Node.js 默认单线程，单核执行 JS
- 如果你在一个 CPU 核心上跑 Node.js Web 服务：
  - 只能处理一个请求的 JS 执行
  - 虽然 I/O（网络、文件、数据库）是异步的，但**CPU 密集计算会阻塞整个线程**
  - 其他请求可能要排队 → 单核吞吐量受限
- 现代服务器多核，单核 Node.js 不能利用多核性能

------

**二、cluster 的价值点**

1. **多核并发处理 HTTP 请求**
   - cluster 会 fork 多个 worker（默认数量 = CPU 核心数）
   - 每个 worker 是独立 Node.js 进程
   - OS 将 worker 调度到不同 CPU 核上
   - **每个 worker 独立处理请求** → 真正实现多核并行
2. **端口共享 + 自动负载均衡**
   - cluster 内部的 master 进程负责把请求分发给 worker
   - 你不需要手动写负载均衡逻辑
   - 例如，访问 `http://localhost:3000`，请求可能落到 worker1，也可能落到 worker2
3. **自动管理 Worker 崩溃**
   - Worker 进程崩溃 → master 自动重启一个新的 worker
   - 提升服务稳定性
4. **无需手动拆分请求**
   - 对于 HTTP 请求，cluster 帮你把请求分配到不同进程
   - 你不需要像 CPU 密集任务那样自己拆分任务

------

**三、什么时候用 cluster**

- **Web 服务或 API 服务**
- **希望充分利用服务器多核 CPU**
- **希望请求处理更稳定，自动重启 worker**

**不适合的场景：**

- 单个 CPU 密集型任务（cluster 不会自动拆分计算）
- 批量数据处理、算法计算（需要自己 fork 或 worker_threads）

------

**四、简单比喻**

- **Node.js 单进程**：一条跑道，只能一辆车（请求）跑
- **cluster**：给每个 CPU 核开一条跑道，每条跑道一辆车 → 同时跑 N 辆车
- **fork 自己的子进程处理 CPU 任务**：你自己去安排车跑哪条跑道，cluster 不干预

------

**五、总结**

> cluster 的核心作用是“让 Node.js Web 服务充分利用多核 CPU，并且管理 worker 稳定性”。
>  它不是计算任务调度器，你的大计算任务**仍然需要自己拆分**。

# 4.你问：CPU 个数 = 核心数 吗？

不完全一样：

- CPU 数量：指有多少个物理 CPU（通常家用电脑 1 个）
- 核心数（Core）：一个 CPU 里有几个执行单元
- 线程数：操作系统看到的硬件线程（HyperThreading 也算）

比如你的电脑：

```
你的 CPU 核心数：4
```

通常表示：

- 1 个物理 CPU
- 4 个核心（每个可以独立并行执行）