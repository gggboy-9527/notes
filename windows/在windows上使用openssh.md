# 在 Windows 上配置 OpenSSH 用于标准部署用户（自动化任务）

本文基于 Microsoft 官方文档：

- [OpenSSH]: https://learn.microsoft.com/zh-cn/windows-server/administration/openssh/openssh-overview

  

目标：创建一个专用的标准用户 `ggboy_deploy`，用于通过 SSH 执行自动化部署任务，并配置基于密钥的身份验证。

------

## 1. 创建部署用户

在目标服务器上以管理员身份运行以下命令，创建一个标准用户（非管理员）：

```powershell
net user ggboy_deploy Password@123 /add
```

> ⚠️ 请确保密码符合系统复杂性策略。

------

## 2. 配置 `sshd_config` 允许该用户登录

编辑文件：
 `C:\ProgramData\ssh\sshd_config`

在文件末尾添加一行，限制仅允许指定用户通过 SSH 登录：

```powershell
AllowUsers ggboy_deploy
```

> ✅ 若需允许多个用户，用空格分隔，例如：
>  `AllowUsers ggcyuser ggboy_deploy`

### 重启 SSH 服务使配置生效：

```powershell
Restart-Service sshd
```

------

## 3. 生成 SSH 密钥对（在本地客户端操作）

推荐使用强算法（如 Ed25519 或 ECDSA）：

```powershell
ssh-keygen -t ecdsa
```

默认私钥路径：`C:\Users\\.ssh\id_ecdsa`
 对应公钥路径：`C:\Users\\.ssh\id_ecdsa.pub`

> 💡 建议设置通行短语（passphrase）以增强安全性，但若用于自动化脚本，可留空（不推荐生产环境）。

------

## 4. 将公钥上传到服务器

在**本地客户端**执行以下 PowerShell 脚本，将公钥写入服务器上部署用户的 `authorized_keys` 文件：

```powershell
$authorizedKey = Get-Content -Path $env:USERPROFILE\.ssh\id_ecdsa.pub

$remotePowershell = "powershell New-Item -Force -ItemType Directory -Path C:\Users\ggboy_deploy\.ssh; Add-Content -Force -Path C:\Users\ggboy_deploy\.ssh\authorized_keys -Value '$authorizedKey'"

ssh ggboy_deploy@47.96.180.221 $remotePowershell
```

> 🔐 此步骤会提示输入 `ggboy_deploy` 用户的密码（即 `Password@123`），因为此时仍启用密码认证。

------

## 5. 确保 `PasswordAuthentication` 临时启用（用于上传公钥）

检查 `C:\ProgramData\ssh\sshd_config` 中是否包含：

```powershell
PasswordAuthentication yes
```

若被注释或设为 `no`，请修改为 `yes`，并重启服务：

```powershell
Restart-Service sshd
```

> ✅ 此设置仅用于初始公钥部署阶段。

------

## 6. 测试密钥登录

从本地使用私钥连接服务器：

```powershell
ssh -i C:\Users\GGBoy\.ssh\id_ecdsa ggboy_deploy@47.96.180.221
```

若成功登录，说明基于密钥的身份验证已配置完成。

------

## 7. **安全加固：禁用密码登录**

确认密钥登录正常后，**强烈建议**禁用密码认证：

修改 `C:\ProgramData\ssh\sshd_config`：

```powershell
PasswordAuthentication no
```

然后重启服务：

```powershell
Restart-Service sshd
```

> 🔒 此操作可有效防止暴力破解攻击。

------

## 8. （可选）将 OpenSSH 默认 Shell 改为 PowerShell

Windows OpenSSH 默认使用 `cmd.exe`，但 PowerShell 功能更强大，更适合自动化脚本。

以**管理员身份**在服务器上运行：

```powershell
$NewItemPropertyParams = @{
    Path         = "HKLM:\SOFTWARE\OpenSSH"
    Name         = "DefaultShell"
    Value        = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    PropertyType = "String"
    Force        = $true
}
New-ItemProperty @NewItemPropertyParams
```

> ✅ 修改后无需重启服务，新会话将自动使用 PowerShell。

------

## 总结

- 创建专用部署用户，最小权限原则。
- 使用 `AllowUsers` 限制 SSH 访问范围。
- 优先使用基于密钥的身份验证。
- 初始阶段启用密码认证上传公钥，完成后立即禁用。
- 将默认 Shell 改为 PowerShell 提升脚本能力。

完成以上步骤后，即可安全、高效地通过 SSH 自动化执行部署任务。