# 第四条：多线程共享内存、并发冲突、Atomics 解决方案

## 一、我们要演示的内容

1. 创建共享内存 `SharedArrayBuffer`
2. 创建两个 Worker Thread，同时操作同一块内存
3. 演示未加锁情况下的“并发冲突 / 脏写”
4. 使用 `Atomics` 修复并发问题
5. 解释线程同步的底层原理

------

# 二、项目目录结构

```
/shared-memory-demo
  main.js
  worker.js
```

------

# 三、第一步：创建共享内存并交给两个线程

## main.js

```
const { Worker } = require('worker_threads');

// 创建一块共享内存，大小为 Int32 结构的 1 个元素
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
const sharedArray = new Int32Array(sharedBuffer);

sharedArray[0] = 0;  // 初始值

console.log('主线程启动，初始值:', sharedArray[0]);

// 创建两个 worker 都访问同一块共享内存
const worker1 = new Worker('./worker.js', { workerData: { sharedBuffer } });
const worker2 = new Worker('./worker.js', { workerData: { sharedBuffer } });

let finished = 0;
const onFinish = () => {
  finished++;
  if (finished === 2) {
    console.log('两个 worker 都执行完毕');
    console.log('最终结果:', sharedArray[0]);
  }
};

worker1.on('exit', onFinish);
worker2.on('exit', onFinish);
```

------

# 四、第二步：Worker 执行大量自增操作（无锁版本）——演示并发冲突

## worker.js

```
const { workerData, threadId } = require('worker_threads');

const sharedArray = new Int32Array(workerData.sharedBuffer);

console.log(`Worker ${threadId} 启动`);

// 每个 worker 执行 100 万次自增
for (let i = 0; i < 1_000_000; i++) {
  sharedArray[0] = sharedArray[0] + 1; // 非原子操作：竞争会出问题
}

console.log(`Worker ${threadId} 结束`);
```

------

# 五、运行

```
node main.js
```

你会看到类似输出：

```
主线程启动，初始值: 0
Worker 1 启动
Worker 2 启动
Worker 1 结束
Worker 2 结束
两个 worker 都执行完毕
最终结果:  1348527 （随机错误的数字）
```

你本来预期是多少？

两个线程各加 1,000,000 次
 **正确结果应该是 2,000,000**

但是你总会看到：

- 不是 2000000
- 每次执行都不同

为什么？

------

# 六、为什么会出错？（重要）

因为以下操作：

```
sharedArray[0] = sharedArray[0] + 1;
```

不是原子操作，它分三步：

1. CPU 读取 sharedArray[0] 值
2. 在寄存器里加 1
3. 再写回 sharedArray[0]

当两个线程交替执行这些步骤时，就会发生：

- 线程 A 和 B 都读到相同的旧值
- 两个线程都写回“旧值 + 1”
- 实际上丢失了一次自增

这叫 **竞争条件（race condition）**。

这是多线程编程的核心难点。

------

# 七、使用 Atomics 修复并发冲突（加锁）

我们修改 worker.js，改为：

## worker.js（使用 Atomics）

```
const { workerData, threadId } = require('worker_threads');

const sharedArray = new Int32Array(workerData.sharedBuffer);

console.log(`Worker ${threadId} 启动 (Atomics)`);

for (let i = 0; i < 1_000_000; i++) {
  Atomics.add(sharedArray, 0, 1); // 原子加法
}

console.log(`Worker ${threadId} 结束`);
```

------

# 八、再次运行

```
node main.js
```

你会看到：

```
最终结果: 2000000
```

每次运行都正确。

------

# 九、总结与解释（你必须掌握）

## 1. 子进程 vs 线程 的核心差异

| 能力         | 子进程             | 线程（Worker Threads）   |
| ------------ | ------------------ | ------------------------ |
| 内存是否共享 | 否                 | 是（SharedArrayBuffer）  |
| 通信方式     | 进程间通信（慢）   | 共享内存 + Atomics（快） |
| 性能成本     | 高                 | 低                       |
| 适合场景     | 独立任务、隔离服务 | CPU 密集计算             |

------

## 2. SharedArrayBuffer 的本质

- 是一块由多个线程共享的二进制内存
- 不拷贝，效率很高
- 需要手动同步（否则竞争）

------

## 3. Atomics 的作用

- 提供低级同步原语（类似锁）
- 保证操作不可被打断
- 防止竞争条件

------

## 4. 为什么线程难写？（面试官也常问）

因为要处理：

- 内存共享
- 同步
- 竞争
- 原子性

而进程之间无需同步（但也更慢）。