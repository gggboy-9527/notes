# 第三条：Worker Threads（多线程）完整演示

## 一、为什么需要 Worker Threads？

Node.js 主线程只负责：

- 执行 JS（单线程）
- 事件循环
- IO 任务调度

但是当我们处理 **CPU 密集型任务**（如图像处理、大量 JSON 解析、加密、AI 计算）：

- 主线程会被阻塞
- 整个服务卡死

所以 Node.js 引入 **Worker Threads**：

- 每个 worker 是一个独立的线程（不是进程）
- 轻量级，没有像子进程那样的独立内存空间
- 能共享内存（更高效）
- 可以运行在多个 CPU 核心上

------

# 二、创建第一个 Node.js 多线程 demo

目录结构：

```
/demo-worker
  main.js
  worker.js
```

------

## main.js

```
const { Worker } = require('worker_threads');

console.log('主线程启动，PID:', process.pid);

const worker = new Worker('./worker.js');

worker.on('message', (msg) => {
  console.log('主线程收到消息:', msg);
});

worker.on('exit', () => {
  console.log('worker 线程退出');
});
```

------

## worker.js

```
const { parentPort, threadId } = require('worker_threads');

console.log('Worker 线程启动，threadId:', threadId);

// 模拟 CPU 密集任务
let sum = 0;
for (let i = 0; i < 5_000_000_00; i++) {
  sum += i;
}

parentPort.postMessage({ result: sum });
```

------

# 三、运行

```
node main.js
```

你会看到：

```
主线程启动，PID: 12345
Worker 线程启动，threadId: 1
主线程收到消息: { result: xxx }
worker 线程退出
```

------

# 四、你应该在任务管理器看到的现象

### 1. 只有 **一个 Node.js 进程**

区别于子进程！
 因为 Worker Thread 是在线程级别创建的。

你会看到：

- node.exe（一个进程）
- CPU 使用率可能上升到多个核心（证明线程在不同 CPU 核执行）

> CPU 核心是调度 **线程** 的，而不是进程。

------

# 五、重要：Worker Threads 与子进程的本质区别

| 能力                  | Worker Threads             | 子进程                   |
| --------------------- | -------------------------- | ------------------------ |
| 是否共享内存          | 是（可以共享 ArrayBuffer） | 否，独立内存             |
| 是否是独立进程        | 否                         | 是                       |
| 是否有独立 PID        | 否                         | 是                       |
| 消息通信效率          | 很高                       | 较低（进程间通信）       |
| 适合任务              | CPU 计算                   | 重任务、IO隔离、独立服务 |
| 是否能使用多个 CPU 核 | 是                         | 是                       |

------

# 六、Worker Threads 是否能跑在其他 CPU 核？

能。
 OS 会自动调度 worker 线程到：

- 同一核
- 或者不同核（更常见）

你不用手动指定。

------

# 七、线程之间如何通信？

Node.js Worker 线程之间通过：

- `postMessage`
- 共享内存（SharedArrayBuffer）
- Atomics（保证并发安全）

我们下一条会演示共享内存，这是比多进程更强的能力。