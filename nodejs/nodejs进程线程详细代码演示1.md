# 第一条：Node.js 进程是什么（演示进程基本信息）

这一条我们要让你**真正看到：**

- Node.js 程序本身就是一个“进程”
- 如何获取进程的 PID（进程 ID）
- 进程的资源信息（内存、运行时间等）
- 如何观察它在操作系统里的存在

------

# 1. 创建文件：`1-process-basic.js`

将下面代码复制进去：

```javascript
// 1-process-basic.js

console.log('Node.js 进程信息演示');

// 当前 Node 进程的 PID（进程 ID）
console.log('进程 PID:', process.pid);

// 当前 Node 进程的运行平台
console.log('运行平台:', process.platform);

// 当前 Node 进程使用的内存
console.log('内存使用情况:', process.memoryUsage());

// 当前 Node 进程的当前工作目录
console.log('当前工作目录:', process.cwd());

// Node.js 版本
console.log('Node 版本:', process.version);

// 打印完整的进程对象（很大）
console.log('完整进程对象（部分）:', {
  execPath: process.execPath,
  title: process.title,
  uptime: process.uptime(),
});
```

# 2.结果

```javascript
Node.js 进程信息演示
进程 PID: 19244
运行平台: win32
内存使用情况: {
  rss: 23494656,
  heapTotal: 4694016,
  heapUsed: 4014888,
  external: 1491739,
  arrayBuffers: 10515
}
当前工作目录: C:\Users\GGBoy\Desktop\codeexample
Node 版本: v20.19.5
完整进程对象（部分）: {
  execPath: 'D:\\nodejs\\node.exe',
  title: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  uptime: 0.0663586
}
```

# 3. 操作系统层面解释（重点）

当你执行：

```
node 1-process-basic.js
```

操作系统做了以下事情：

1. **创建了一个新的进程**（这就是 Node.js 进程）
2. 给该进程分配独立的内存空间
3. 进程里包含多个线程：
   - 主线程（执行你的 JS）
   - libuv 线程池（默认 4 个线程）
   - 其他内部线程

所以：

- **Node.js 是单线程执行 JS 的（主线程）**
- **但 Node.js 的进程本身不是单线程的**
- 你刚运行的这个脚本，就是在主线程中执行的

PID（process.pid）就是操作系统在进程表中的编号。

你现在确实运行了一个真实的、独立的进程。

------

# 4. 你还可以做一个额外验证（非必需）

可以在代码里加个定时器，让程序一直在执行这样方便看到；

```javascript
setInterval(() => {
  console.log('进程仍在运行...');
}, 1000);
```

因为：

这个脚本**非常快** —— 代码执行只需要几毫秒。
 执行完后：

1. Node.js 主线程执行完所有同步代码
2. 事件循环里没有待处理任务
3. Node.js 进程自动退出
4. 操作系统立刻回收该进程
5. 因此你打开任务管理器时，它已经不在了

这正是 Node 的特性：
 **如果事件循环里没有任何待处理任务，进程会自动退出。**

打开系统任务管理器：

### Windows

按下 `Ctrl + Shift + Esc`
 → 任务管理器
 → 详情
 → 找到 `node.exe`
 → 查 PID 是否和你的代码输出一致

你会看到一个和代码输出相同的 PID。

这就证明了：**你写的 Node.js 程序就是一个独立的 OS 进程。**