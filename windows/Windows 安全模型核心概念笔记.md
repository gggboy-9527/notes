# Windows 安全模型核心概念笔记

> —— 从 SSH 密钥权限问题出发，彻底搞懂“谁”、“能操作什么”、“如何判断”

------

## 🧩 引言：为什么我要搞懂这个？

作为程序员，在部署服务、配置 SSH、写 Windows 服务或自动化脚本时，经常遇到：

- “Access Denied” 错误
- OpenSSH 报错：“Permissions for ‘xxx’ are too open”
- 不知道该给哪个用户/组授权

这些都源于对 **Windows 安全模型**理解不足。
 本文从我的真实疑问出发，系统梳理核心概念。

------

## 🔒 Windows 如何通过身份组织阻止未授权访问？

Windows 并不是“谁都能随便操作一切”的系统。它从设计上就通过 **身份组织机制** 来限制用户行为，确保系统安全。

### 1. 身份是操作的前提

- 在 Windows 中，**任何操作都必须关联一个身份**（即安全主体）
- 即使你双击一个 `.exe`，它也是以**当前登录用户的身份**运行
- 没有身份？→ 不可能（连匿名访问也对应 `ANONYMOUS LOGON` 这个特殊主体）

### 2. 默认用户与默认组：预设的安全边界

Windows 安装后即内置一套 **身份组织结构**，形成初始安全策略：

| 类型         | 名称             | 作用       | 权限级别                             |
| ------------ | ---------------- | ---------- | ------------------------------------ |
| **默认用户** | `Administrator`  | 超级管理员 | 最高（但受 UAC 限制）                |
|              | `Guest`          | 来宾账户   | 极低（默认禁用）                     |
| **默认组**   | `Administrators` | 管理员组   | 成员拥有完全控制权                   |
|              | `Users`          | 普通用户组 | 可运行程序、读公共文件，但不能改系统 |
|              | `Guests`         | 来宾组     | 几乎无权限                           |

> ✅ 这些默认账户和组构成了 Windows 的 **“权限基线”**
> —— 新建用户默认加入 `Users` 组，天然受限；只有加入 `Administrators` 才能提权。

### 3. 用户必须属于至少一个组

- Windows **不允许“孤立用户”**
- 每个用户创建时，自动加入：
  - `Users`（普通用户）
  - 或 `Administrators`（如果创建为管理员）
- **组是权限分配的最小管理单元**：
  - 管理员不用给 100 个人逐个授权 → 只需把他们加入一个组，给组授权即可

### 4. 系统资源默认只信任“可信身份”

- 系统目录（如C:\Windows）、注册表关键项、服务等，默认 ACL（这里见后续的介绍） 通常只允许：
  - `SYSTEM`
  - `Administrators`
  - 有时 `TrustedInstaller`（Windows 自己的更新账户）
- 普通用户（`Users` 组）尝试写入 → **Access Denied**

> 🌰 举例：
> 你用普通用户身份运行 `notepad C:\test.txt` → 成功
> 但运行 `notepad C:\Windows\test.txt` → 失败
> 因为 `C:\Windows` 的 DACL **没有给 `Users` 写权限**

### 5. 这就是“阻止”的本质

Windows 不是靠“禁止你点击”来保护系统，而是：

> **所有资源都带着 ACL，所有操作都带着 Token，系统实时比对——不匹配？拒绝！**

这种机制使得：

- 普通用户无法破坏系统文件
- 恶意软件难以提权（除非利用漏洞）
- 多用户环境彼此隔离

> 💡 所以：**用户 + 组 + 默认安全策略 = Windows 的第一道防线**

------

## 🔑 核心三要素框架

Windows 安全模型可概括为：

> **Who（谁） × What（操作什么） × How（如何判断）**

下面逐一拆解。

------

### 1. Who：谁？—— 安全主体（Security Principal）

#### ❓ 我的疑问：

> “安全主体是用户或组的统称？那它到底是什么？能不能直接授权给具体用户？”

#### ✅ 回答：

**安全主体（Security Principal） = 系统中所有能被授予权限的身份实体**，包括：

- **用户（User）**：如 `Administrator`、`GGBoy`
- **组（Group）**：如 `Administrators`、`Users`

> ✅ **ACL 中完全可以直接写具体用户名**！
> 例如：`[允许] GGBoy : 读取` 是完全合法的。

#### 关键细节：

- 每个安全主体都有唯一SID（Security Identifier）

  - 用户 SID 示例：`S-1-5-21-...-1013`
  - 组 SID 示例：`S-1-5-32-544`（= `Administrators`）

- **SID 才是系统内部识别身份的依据**，用户名只是别名

- 内置用户：

  - `Administrator`（SID 以 `-500` 结尾）
  - `Guest`

- 特殊身份：

  - `SYSTEM`：不是用户，是操作系统内核身份（SID `S-1-5-18`），权限高于 Administrator

- 可以创建新用户/组：

  ```powershell
  New-LocalUser -Name "deploy" -Password (ConvertTo-SecureString "P@ss" -AsPlainText -Force)
  New-LocalGroup -Name "WebDeployers"
  ```

------

### 2. What：能操作什么？—— 受保护的对象（Securable Objects）

#### ❓ 我的疑问：

> “除了文件，还有什么东西是可以被权限控制的？”

#### ✅ 回答：

Windows 中**几乎所有资源都是受保护对象**，它们都支持 ACL 权限控制：

| 对象类型      | 示例                  | 说明          |
| ------------- | --------------------- | ------------- |
| 文件 / 目录   | `C:\data\log.txt`     | 最常见        |
| 注册表项      | `HKLM\SOFTWARE\MyApp` | 控制配置读写  |
| 进程 / 线程   | `nginx.exe`           | 谁能终止/调试 |
| 服务          | `sshd`, `Spooler`     | 谁能启动/停止 |
| 命名管道      | `\.\pipe\mysql`       | IPC 通信安全  |
| 窗口站 / 桌面 | Winlogon 桌面         | GUI 会话隔离  |

> 💡 技术上，这些对象都包含一个 **安全描述符（Security Descriptor）**，用于存储权限信息。

------

### 3. How：如何判断权限？—— Token + ACL 匹配机制

#### ❓ 我的疑问：

> “系统判断权限时，是只看我本人，还是看我所属的组？Token 到底是什么？”

#### ✅ 回答：

权限判断依赖两个核心组件：

##### 3.1 访问令牌（Access Token）

- 用户登录成功后，系统生成的 **“数字身份证”**
- 包含：
  - 你本人的 SID
  - 你所属的所有组的 SID（如 `Administrators`, `Users`）
  - 特权（Privileges）
  - 完整性级别（UAC 相关）

> ✅ **Token 不只包含“组”，也包含“你本人”！**
> 所以系统既能匹配 `[允许] GGBoy`，也能匹配 `[允许] Administrators`

查看你的 Token：

```powershell
whoami /all
```

##### 3.2 ACL 与 ACE

- **ACL（Access Control List）**：对象的权限规则列表，每一条数据由一条ACE组成

- ACE（Access Control Entry）：ACL 中的每一条规则，格式为：

  ```
  [类型] 安全主体 : 权限
  ```

  - 类型：`允许`（Allow） 或 `拒绝`（Deny）
  - 安全主体：用户或组
  - 权限：读、写、执行等

```
[允许] Administrators : 完全控制
[允许] GGBoy         : 读取
[拒绝] Guests         : 所有权限
```

##### 3.3 权限检查流程（关键！）

1. 获取你的 Token（含本人 + 所有组）
2. 遍历对象 DACL：
   - **先检查所有 Deny ACE** → 若匹配，**立即拒绝**
   - **再检查所有 Allow ACE** → 若匹配，记录允许权限
3. 请求的操作 ⊆ 允许权限？→ 允许；否则拒绝

> ⚠️ **“拒绝优先”原则**(这个非常的重要)：
> 即使你是 `Administrators`，如果单独对你设了 `[拒绝] GGBoy: 写入`，你就不能写！

##### 3.4 权限继承

- 子对象默认继承父对象 ACL

- 可关闭继承（如 SSH 密钥文件）：

  ```
  icacls keyfile /inheritance:r
  ```

------

## 🛡️ 安全描述符（Security Descriptor）详解

## 🔐 一、什么是安全描述符（Security Descriptor）？

### 📌 定义：

> **安全描述符 = Windows 中每个受保护对象（文件、注册表、进程等）附带的一段元数据**，用于描述：
>
> - 谁拥有这个对象（Owner）
> - 谁能对它做什么（DACL）
> - 谁的操作需要被记录（SACL）

你可以把它想象成一个对象的 **“安全身份证”**。

------

## 🧩 二、安全描述符的组成

一个完整的安全描述符包含 **4 个关键部分**：

| 组件      | 全称                              | 作用                              |
| --------- | --------------------------------- | --------------------------------- |
| **Owner** | 所有者                            | 谁创建/拥有这个对象（可修改 ACL） |
| **Group** | 所属组                            | POSIX 兼容用（Windows 基本不用）  |
| **DACL**  | Discretionary Access Control List | **控制访问权限**（核心！）        |
| **SACL**  | System Access Control List        | **控制审计日志**（高级功能）      |

> 💡 我们平时说的 “文件的 ACL”，通常特指 **DACL**。

------

## ✅ 三、DACL：Discretionary ACL（自主访问控制列表）

### 🎯 作用：

> **决定“谁可以对这个对象执行什么操作”** → 这就是你之前学的 **权限控制**！

### 🔧 结构：

- 由多条 **ACE（Access Control Entry）** 组成
- 每条 ACE 是 `[允许/拒绝] + [安全主体] + [权限]`

### 🌰 例子（文件 DACL）：

```
[允许] Administrators : 完全控制
[允许] GGBoy         : 读取
[拒绝] Guests         : 所有权限
```

→ 这就是典型的 **DACL 内容**

### ⚠️ 关键行为：

- 如果 DACL **为空** → **拒绝所有访问**
- 如果 DACL **不存在**（null）→ **允许所有人完全访问！**（非常危险）

> ✅ 所以：**DACL = 我们日常说的“权限设置”**

------

## 🕵️ 四、SACL：System ACL（系统访问控制列表）

### 🎯 作用：

> **决定“当某个安全主体访问此对象时，是否要记录一条审计日志”**

### 🔧 结构：

- 也由 ACE 组成，但类型不同：
  - 不是 “Allow/Deny”
  - 而是 **“成功时审计” / “失败时审计”**

### 🌰 例子（文件 SACL）：

```
[审计成功] GGBoy : 写入
[审计失败] Everyone : 删除
```

→ 含义：

- 当 `GGBoy` 成功写入该文件 → 记录一条成功日志
- 当任何人尝试删除失败 → 记录一条失败日志

### 📂 日志去哪了？

- 写入 Windows事件查看器（Event Viewer）
  - 路径：`Windows Logs → Security`
  - 事件 ID：如 4663（对象访问）

### ⚠️ 启用 SACL 的前提：

1. 系统必须启用对象访问审计策略
   - 本地安全策略 → 审核策略 → “审核对象访问” = 成功/失败
2. **只有管理员或 SYSTEM 能设置 SACL**

> 💡 普通用户右键文件 → “安全” 选项卡 → **看不到 SACL 设置**！
> 需要用高级工具（如 `auditpol` + `icacls /setsacl` 或 PowerShell 的 `Get-Acl -Audit`）

------

## 🆚 对比总结：DACL vs SACL

| 特性             | DACL                      | SACL                          |
| ---------------- | ------------------------- | ----------------------------- |
| **目的**         | 控制访问（Authorization） | 记录访问（Auditing）          |
| **影响操作**     | 直接允许/拒绝             | 不影响操作，只写日志          |
| **ACE 类型**     | Allow / Deny              | Audit Success / Audit Failure |
| **谁可设置**     | 对象所有者、管理员        | 仅管理员（需开启审计策略）    |
| **默认存在吗？** | 通常有                    | 默认无（需手动配置）          |
| **日常使用频率** | ⭐⭐⭐⭐⭐（极高）             | ⭐⭐（企业安全/合规场景）       |

------

## 🛠️ 五、技术演示（PowerShell）

### 1. 查看文件的安全描述符（含 DACL）

```
$acl = Get-Acl "C:\test.txt"
$acl.Access  # 显示 DACL 中的 ACE（即权限）
```

### 2. 查看 SACL（需要管理员权限 + 审计启用）

```
# 启用对象审计（管理员运行）
auditpol /set /subcategory:"File System" /success:enable /failure:enable

# 设置 SACL（复杂，通常用 GUI 或专用工具）
# 普通用户无法直接操作 SACL
```

> 💡 实际中，SACL 多用于：
>
> - 合规要求（如金融、医疗行业）
> - 追踪敏感文件访问（如 `salary.xlsx`）
> - 安全事件溯源

------

## 🧠 六、为什么叫 “Discretionary”（自主）？

- **DACL 是“自主”的**：对象所有者可以**自行决定**给谁授权（比如你给自己文件加权限）
- 对比：**强制访问控制（MAC）** 如 SELinux，由系统策略强制规定，用户不能改

> Windows 主要是 **DAC（自主访问控制）模型**，所以叫 **Discretionary ACL**

------

## ✅ 最终总结

| 概念     | 是什么                  | 你是否需要关心？        |
| -------- | ----------------------- | ----------------------- |
| **ACL**  | 总称，包括 DACL 和 SACL | ✅ 是基础术语            |
| **DACL** | 控制“谁能做什么”        | ✅✅✅ 日常权限管理的核心  |
| **SACL** | 控制“谁的操作要记日志”  | ✅ 企业安全/审计场景需要 |

## 📋 附录：常用命令速查

| 功能             | 命令                                                       |
| ---------------- | ---------------------------------------------------------- |
| 查看当前用户及组 | `whoami /all`                                              |
| 查看文件 DACL    | `icacls filename`                                          |
| 授予读权限       | `icacls file /grant "User:(R)"`                            |
| 授予完全控制     | `icacls file /grant "User:(F)"`                            |
| 关闭继承         | `icacls file /inheritance:r`                               |
| 启用文件审计     | `auditpol /set /subcategory:"File System" /success:enable` |

------

## ✅ 总结：一张图理解 Windows 安全模型

```
用户 GGBoy 登录
        ↓
系统生成 Access Token
（含 GGBoy + Administrators + Users ...）
        ↓
尝试访问文件 secret.txt
        ↓
系统读取文件的 DACL：
  [允许] Administrators: 读取
  [拒绝] Guests: 所有权限
        ↓
匹配 Token 中的安全主体 → Administrators 匹配 → 允许读取！
```

> **Windows 安全 = 身份（Principal + SID） + 资源（Object + DACL） + 验证（Token 匹配）**

掌握这套模型，你就能：

- 正确配置 SSH、服务、脚本权限
- 快速排查 “Access Denied”
- 设计安全、合规的应用架构

