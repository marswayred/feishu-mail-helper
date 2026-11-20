# 飞书邮箱助手

在飞书工作台内打开的 H5 网页应用，React + Node.js。

- **按工号查询**：一行一个工号，严格匹配通讯录 `employee_no`，保留前导零。
- **按人员 / 部门查询**：调用飞书原生 `chooseContact`，支持多选成员和部门，默认包含全部子部门。
- **统一输出**：邮箱去重、单个空格分隔、一键复制；不自动添加括号或分号。
- **异常可见**：未匹配、重复工号歧义、未获取企业邮箱、无效邮箱、暂停或离职成员分别提示。
- **演示隔离**：无需凭证即可体验四位虚构成员。生产模式拒绝运行演示数据。

> 真实飞书租户联调尚未进行：当前没有应用凭证、管理员授权或真实客户端授权码。单元测试、HTTP 集成测试、桌面 / 手机尺寸浏览器测试验证的是代码和演示 / mock 链路，不代表已上线。

## 快速运行

要求 Node.js **22.12+**（建议受支持的 LTS 版本），npm。

```bash
npm ci
cp .env.example .env
npm run dev
```

打开 **http://localhost:5173**。默认 `APP_MODE=demo`。点击“填入示例”并查询，可以得到：

```text
lin.xiao@example.com chen.yu@example.com xu.yan@example.com
```

示例工号 `E1003` 对应成员未配置企业邮箱，会单独显示在“待确认”。选择“产品研发”部门并包含子部门，也会展开四位成员；重复选同一成员不会重复导出邮箱。

开发服务器前端端口为 5173，后端为 3000。同源校验会区分 `localhost` 与 `127.0.0.1`，请使用上述地址，或同时修改 [环境配置](<.env.example>) 中的 `APP_ORIGIN`。不要将开发演示服务暴露到公网。

若本机默认 npm 缓存权限异常，可运行 `npm ci --cache .npm-cache`；无需修改全局目录所有权。

### 本地验证构建产物

```bash
npm run build
APP_MODE=demo APP_ORIGIN=http://127.0.0.1:3000 npm start
```

访问 http://127.0.0.1:3000。此命令仍是非生产演示，不能用于真实上线。

## 接入飞书

### 1. 创建企业自建网页应用

在 [飞书开发者后台](https://open.feishu.cn/app) 创建企业自建应用，启用网页应用能力，将部署后的 HTTPS 地址配置为工作台应用入口。凭证由管理员在部署服务器配置，**不要放在前端代码、`VITE_` 变量或 Git 中**。

参考：[网页应用概述及官方 SDK](https://open.feishu.cn/document/uYjL24iN/uMTMuMTMuMTM/introduction.md)。前端按需加载官方 `h5-js-sdk-1.5.48.js`，不使用多维表格扩展 SDK，也不使用未经核实的 npm JSSDK 包。

### 2. 配置权限和通讯录数据范围

推荐从以下较细粒度的**应用身份**权限组合开始，并按开发者后台实际权限名称核对：

```text
contact:contact.base:readonly
contact:user.base:readonly
contact:user.employee:readonly
contact:user.employee_id:readonly
```

用途分别是通讯录接口读取、姓名、员工字段（工号 / 企业邮箱 / 状态）、授权范围接口的成员 ID。较宽的替代组合是 `contact:contact:readonly_as_app` + `contact:user.employee_id:readonly`，但不应仅为省配置而扩大授权。

**同时配置通讯录数据权限范围**，推荐先授权测试部门。仅开 API 权限不代表可以访问全企业；修改后需发布版本并由管理员审核生效。

特别注意：

- `employee_no` 才是工号；`user_id` 不是工号，二者不能互换。
- **只读取 `enterprise_email`**。这个字段依赖管理员启用飞书邮箱服务；没有该服务或字段权限时可能为空。本项目不会以 `email`（个人 / 联系邮箱）代替。
- 如果你们企业邮箱实际上只保存在 `email` 或其他 HR 系统，本版本会提示未获取企业邮箱；请先确认数据源并明确变更映射策略，不要直接回退混用。
- `contact:user.email:readonly` 不能代替本项目的企业邮箱字段权限。
- 工号查询需要扫描应用授权范围。当前支持“部门 + 单独成员”授权，**不支持非空 `group_ids` 用户组授权**；遇到会明确报错，而非漏查后显示完成。
- scopes 文档没有承诺空数组一定不会省略。本版本要求 `user_ids`、`department_ids`、`group_ids` 三个数组明确存在；若真实租户省略某个空字段，会拒绝扫描，需在联调时确认，不能把缺失字段默认当成空范围。

官方依据：[用户字段与权限](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/get.md)、[通讯录授权范围](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/scope/list.md)、[直属部门成员](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/find_by_department.md)、[递归子部门](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/department/children.md)。

### 3. 配置网页安全设置

配置部署域名对应的安全域名 / JS SDK 鉴权设置，并把**调用授权接口的页面地址**加入重定向 URL 列表。例如部署在 `https://mail-helper.example.com/`，应用首页、重定向 URL 及服务端 `APP_ORIGIN` 应相互匹配（`APP_ORIGIN` 只含来源，不含路径）。

签名使用当前页面 URL，保留查询参数、去除 hash；后端只为允许的来源生成签名。代理应保留原始 URL，不要在 SDK 初始化后改写地址。

参考：[飞书客户端内网页应用接入指南](https://open.feishu.cn/document/uYjL24iN/uMTMuMTMuMTM/development-guide/webapp-incremental-authorization-access-guide.md)、[h5sdk.config](https://open.feishu.cn/document/web-app/gadget-api/open-ability/authentication/h5sdkconfig.md)。

### 4. 生产环境变量

从 [配置模板](<.env.example>) 创建服务器本地的 `.env`，填写：

```dotenv
NODE_ENV=production
APP_MODE=feishu
APP_ORIGIN=https://mail-helper.example.com
HOST=127.0.0.1
PORT=3000
FEISHU_APP_ID=cli_替换为实际值
FEISHU_APP_SECRET=替换为实际密钥
FEISHU_TENANT_KEY=替换为本企业租户标识
ALLOWED_OPEN_IDS=ou_获准使用此工具的成员1,ou_成员2
TRUST_PROXY=1
```

`FEISHU_TENANT_KEY` 是企业租户标识，由管理员确认；不要为了省配置取消租户检查。`ALLOWED_OPEN_IDS` 可为空，表示允许该租户内能授权本应用的成员使用。**建议上线首期显式填写使用者白名单。**

本应用以 tenant token 读取统一的“应用可见通讯录范围”，并非以当前操作者的个人通讯录可见范围查询。因此，获得本工具使用权的人能够查询该应用授权范围内的企业邮箱。若需要不同用户不同的数据范围，须增加服务端 ACL 或调整数据访问模型后再上线。

`TRUST_PROXY=1` 仅用于**恰好一层可信反向代理**，Node 端口不得允许绕过代理从公网访问；否则保留 0。容器内如需监听所有网卡，可设 `HOST=0.0.0.0`，并限制容器网络入口。

### 5. 构建与启动

```bash
npm ci
npm run build
npm start
```

Node 同时提供静态构建产物和 `/api`，无需另起 Vite 生产服务。使用系统服务或进程管理器守护进程，TLS 由可信网关 / 反向代理终止。反向代理请求超时建议至少 120 秒（应用整次扫描上限 110 秒），API 响应不可缓存，日志不要记录请求体、授权码或完整 Cookie。

本版本会话在单个 Node 进程内存中，重启后需重新登录。多实例部署必须改为共享会话存储、共享限流 / 并发限制，或使用严格黏性会话并接受其限制；不要直接负载均衡多个独立实例。配置变更后重启会清除旧会话。

### 6. 飞书内联调清单

1. 使用飞书桌面端或 iOS / Android **6.9+**，从工作台打开正式应用，点击“登录飞书”。普通浏览器不能调用原生选择器。Harmony 端的部门选择当前不在本版本承诺支持范围内。
2. 确认授权 code 可以完成 `requestAccess → OAuth v3 token → user_info`，租户与白名单验证通过。本项目使用当前 v3 token 接口；官方端内指南仍展示 v2 示例，因此这一步必须在真实客户端验证，不能只凭 mock 测试验收。
3. 用有前导零的真实工号、无邮箱成员和不存在工号验证提示；确认没有个人邮箱回退。
4. 用父部门、子部门、同时选成员与其部门验证递归和去重；检查没有隐藏的无权限部门。
5. 核对原生选择器返回 `openId` 与 `openDepartmentId`；不可使用 `departmentId` 调用 OpenAPI。
6. 核对 scopes 在当前租户的空字段序列化，测试跨授权范围查询失败是否清晰。
7. 验证退出、会话过期、复制失败降级和管理员撤权后的行为；按公司数据政策确定发布对象。

参考：[requestAccess](https://open.feishu.cn/document/web-app/gadget-api/open-ability/login/requestaccess.md)、[OAuth v3](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3.md)、[登录用户信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get.md)、[原生 chooseContact](https://open.feishu.cn/document/client-docs/gadget/-web-app-api/open-ability/contact/choosecontact.md)。

## 查询规则和安全边界

- 最多 1,000 个工号；或 1,000 位直接选择的成员 + 100 个部门。输入请求体最多 64KB，工号单项最多 128 个非空白字符。
- 部门自身及其后代逐一获取直属成员，按 `open_id` 去重；邮箱按大小写不敏感去重，保留首次出现的写法与顺序。
- 工号精确匹配、区分大小写；重复工号对应多个人时不猜测；离职、退出和暂停成员不输出邮箱。
- 每次扫描最多 25,000 个处理项，重复部门归属也计入扫描成本；每个分页循环最多 1,000 页。超限、重复分页 token、未知授权范围或接口失败均不返回部分成功。
- 单次上游请求默认 10 秒超时，瞬时限流最多重试 2 次；月配额耗尽不重试。整次扫描 110 秒上限，客户端断连会向飞书请求传递取消信号。扫描与登录分别限制并发，避免扫描阻断登录。
- API 按 IP 限流，登录更严格；同源检查、请求大小与 ID 校验、HttpOnly / SameSite Cookie、生产 Secure Cookie、租户与可选白名单验证。
- 会话最长 1 小时，到期重新登录；应用 token / JS ticket 在后端短期缓存。不会把 app secret、用户 token、tenant token 或 ticket 发到前端。
- 不保存查询历史，也不将通讯录写入数据库或浏览器持久存储；查询结果暂存在响应与当前页面内存。点击复制后，剪贴板由操作系统管理，可能被其它应用访问，请按公司要求使用。
- 原生 API 只提供成员预选，已选部门由页面保留；取消部门请使用页面标签的“移除”按钮。
- 默认不记录请求体与查询结果。网关日志、浏览器缓存策略、访问人员和输出后的传播仍需部署方管理。

## 测试

```bash
npm test
npm run build

# 只需首次安装浏览器；可使用标准 Playwright 缓存位置
npx playwright install chromium --only-shell
npm run test:ui
```

也支持项目内缓存：

```bash
PLAYWRIGHT_BROWSERS_PATH=.browser-cache npx playwright install chromium --only-shell
npm run test:ui
```

浏览器脚本会创建临时回环测试服务，运行完关闭，不启动替代 GUI 或常驻服务器。截图保存至 [.impeccable/review](<.impeccable/review/>)（Git 忽略）。测试包含空态、加载后结果、工号去重、未匹配、邮箱缺失、复制、编辑后清除旧结果、成员与父子部门、关闭子部门、空结果、超限、服务错误、桌面及手机布局。

## 代码入口

- [交互界面](<src/main.jsx>) / [响应式样式](<src/styles.css>)
- [飞书前端适配](<src/feishu.js>)：官方 SDK、免登、签名和原生选人
- [HTTP 与安全边界](<server/app.js>) / [服务入口](<server/index.js>)
- [飞书客户端及目录遍历](<server/feishu.js>)
- [工号 / 人员 / 部门解析](<server/directory.js>)
- [虚构演示通讯录](<server/demo.js>)
- [自动化浏览器验收](<scripts/test-ui.js>)

## 常见问题

**显示“请求来源不受信任”**：浏览器实际来源与 `APP_ORIGIN` 不一致。检查协议、主机和端口，尤其 `localhost` / `127.0.0.1`。

**工号全未匹配**：确认使用的是 `employee_no`，应用已发布，字段权限已审核，成员在应用数据范围内。不存在和不可见不能被本工具区分。

**成员有邮箱但显示缺失**：检查管理员是否启用飞书邮箱、是否配置 `enterprise_email` 及其字段权限。联系邮箱 `email` 不等于企业邮箱字段。

**选择器能选到，但查询失败**：原生选择器可见范围与 OpenAPI 应用数据范围不保证完全相同。服务端仍以 API 授权范围为准，不绕过权限。

**SDK 鉴权失败**：检查安全域名、页面重定向 URL、App ID、服务器时钟、URL 查询参数是否被代理修改，并确认在飞书客户端内打开。

**部门人数较多时超时**：先缩小查询 / 授权范围；大企业建议另行实现受控索引同步与访问控制，不要无限提高扫描限额。
