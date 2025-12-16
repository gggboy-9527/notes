原生的docker是linux写的，如果我们在linux上直接运行，我们是不需要这个desktop的；这个desktop，是为了让我们能够在windows上运行docker而做的；这是官方做的产品；

为什么能够运行？因为docker一定依赖liunx的内核，而windows上，通过自己的虚拟化技术，有个叫做wsl的东西，你可以把它理解为就是linux的内核，所以，desktop实际上是自己在windows上，使用wsl，来让docker引擎运行的；

关于wsl的介绍：

## **WSL（Windows Subsystem for Linux）**

WSL是微软在Windows 10/11中推出的功能，它让用户可以在Windows上**直接运行Linux二进制可执行文件**，而无需虚拟机或双系统。

**主要特点：**

- 翻译层架构：将Linux系统调用转换为Windows系统调用
- 与Windows文件系统互通
- 可以直接在命令行运行Linux工具和应用程序
- 2016年首次发布（WSL1）

## **WSL2（第二代WSL）**

WSL2是WSL的升级版本，带来了**架构上的重大改变**：

**核心变化：**

- **基于轻量级虚拟机**：在Hyper-V虚拟化平台上运行真正的Linux内核
- **完整的Linux内核**：不再是系统调用翻译，而是真正的Linux内核
- 性能大幅提升，特别是文件系统操作

## **WSL1 vs WSL2 主要区别**

| 特性                   | WSL1                       | WSL2                           |
| :--------------------- | :------------------------- | :----------------------------- |
| **架构**               | 系统调用翻译层             | 轻量级虚拟机                   |
| **启动速度**           | 更快                       | 稍慢（但差异很小）             |
| **文件系统性能**       | Windows文件慢，Linux文件快 | 大幅提升（特别是Linux文件）    |
| **内存占用**           | 较少                       | 较多（可配置上限）             |
| **完全系统调用兼容性** | 部分支持                   | 完全支持                       |
| **Docker支持**         | 需要Docker Desktop         | 原生支持（无需Docker Desktop） |



还有一点，desktop的官方文档说了，可以通过他，切换windows容器和linux容器，这个是什么意思呢？

首先，我们要清楚，容器化，知识一种技术，windows有自己的容器化技术，我们用的docker是linux的容器化技术，而虽然desktop是docker的产品，但是他们和windows达成了合作，让这个产品同样的兼容微软的容器化技术；