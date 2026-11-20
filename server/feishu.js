import { assertScanLimit, departmentId, userId, SCOPE_NOTE, DirectoryError } from './directory.js';

const ORIGIN = 'https://open.feishu.cn';
const TOKEN_PATH = '/open-apis/auth/v3/tenant_access_token/internal';
// Monthly quota exhaustion (99991403) is not a transient frequency limit.
const RATE_LIMIT_CODES = new Set([99991400, 1000004, 1000005]);
const MAX_PAGES = 1000;

export class FeishuApiError extends Error {
  constructor(message, { code, status, path, requestId, cause } = {}) {
    super(message, { cause });
    this.name = 'FeishuApiError';
    this.code = code;
    this.status = status;
    this.path = path;
    this.requestId = requestId;
  }
}

function apiUrl(path, query) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('飞书 API path 必须为相对路径，不能传入外部网址');
  }
  const url = new URL(path.startsWith('/open-apis/') ? path : `/open-apis${path}`, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/open-apis/')) throw new TypeError('无效的飞书 API 路径');
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function checkTimeout(value) {
  if (!Number.isFinite(value) || value < 1 || value > 60_000) throw new RangeError('timeoutMs 必须在 1–60000 毫秒之间');
  return value;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason || new Error('请求已取消')); return; }
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason || new Error('请求已取消')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// Cancel only this wait, never the shared token refresh. Both settlement handlers
// remain attached so a later refresh failure is observed even after cancellation.
function waitForShared(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      reject(signal.reason || new Error('请求已取消'));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => { cleanup(); resolve(value); },
      error => { cleanup(); reject(error); },
    );
    if (signal.aborted) abort();
  });
}

export class FeishuClient {
  constructor({ appId, appSecret, fetchImpl = fetch, timeoutMs = 10_000, maxRetries = 2 } = {}) {
    if (typeof appId !== 'string' || !appId.trim() || typeof appSecret !== 'string' || !appSecret.trim()) {
      throw new TypeError('缺少飞书 APP_ID 或 APP_SECRET');
    }
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl 必须为函数');
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) throw new RangeError('maxRetries 必须在 0–5 之间');
    this.appId = appId;
    this.appSecret = appSecret;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = checkTimeout(timeoutMs);
    this.maxRetries = maxRetries;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.tokenPromise = null;
  }

  async getTenantToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      const issuedAt = Date.now();
      const result = await this._request(TOKEN_PATH, {
        method: 'POST', body: { app_id: this.appId, app_secret: this.appSecret },
      });
      if (typeof result.tenant_access_token !== 'string' || !result.tenant_access_token ||
          !Number.isFinite(result.expire) || result.expire <= 0) {
        throw new FeishuApiError('飞书 token 响应缺少有效 tenant_access_token/expire', { path: TOKEN_PATH });
      }
      this.token = result.tenant_access_token;
      const lifetime = result.expire * 1000;
      this.tokenExpiresAt = issuedAt + lifetime - Math.min(60_000, lifetime * 0.1);
      return this.token;
    })();
    try { return await this.tokenPromise; }
    finally { this.tokenPromise = null; }
  }

  async request(path, { method = 'GET', body, ...options } = {}) {
    // Validate before retrieving credentials. Callers cannot redirect token-bearing requests.
    apiUrl(path, options.query);
    if (options.signal?.aborted) throw options.signal.reason || new Error('请求已取消');
    const token = await waitForShared(this.getTenantToken(), options.signal);
    options.signal?.throwIfAborted();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return this._request(path, { ...options, method, body, headers });
  }

  async _request(path, { method = 'GET', body, headers, query, signal, timeoutMs = this.timeoutMs } = {}) {
    const url = apiUrl(path, query);
    checkTimeout(timeoutMs);
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Content-Type', 'application/json; charset=utf-8');
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const { response, payload } = await this._fetchJson(url, {
        method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
      }, timeoutMs, signal);
      const code = payload?.code;
      const limited = response.status === 429 || RATE_LIMIT_CODES.has(code);
      if (limited && attempt < this.maxRetries) {
        const retryAfter = response.headers?.get('retry-after');
        const seconds = retryAfter == null ? NaN : Number(retryAfter);
        const parsedDate = retryAfter == null ? NaN : Date.parse(retryAfter);
        const delay = Number.isFinite(seconds) ? seconds * 1000 :
          Number.isFinite(parsedDate) ? parsedDate - Date.now() : 250 * 2 ** attempt;
        await wait(Math.max(0, Math.min(5000, delay)), signal);
        continue;
      }
      if (!response.ok || code !== 0) {
        const apiMessage = typeof payload?.msg === 'string' ? payload.msg.slice(0, 400) : '响应缺少合法 API 状态';
        // Never include request body, token or app secret in errors.
        throw new FeishuApiError(`飞书 API ${url.pathname} 失败（HTTP ${response.status}, code ${code ?? 'unknown'}）：${apiMessage}${limited ? '；限流重试次数已耗尽' : ''}`, {
          status: response.status, code, path: url.pathname,
          requestId: response.headers?.get('x-request-id') || undefined,
        });
      }
      return payload;
    }
  }

  async _fetchJson(url, options, timeoutMs, signal) {
    const controller = new AbortController();
    let timer;
    let abort;
    const deadline = new Promise((_, reject) => {
      abort = () => {
        controller.abort();
        reject(new FeishuApiError('飞书请求已取消', { code: 'ABORTED', path: url.pathname }));
      };
      timer = setTimeout(() => {
        controller.abort();
        reject(new FeishuApiError(`飞书 API 请求超时（${timeoutMs}ms）`, { code: 'TIMEOUT', path: url.pathname }));
      }, timeoutMs);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
    const operation = (async () => {
      try {
        const response = await this.fetchImpl(url.toString(), { ...options, signal: controller.signal, redirect: 'error' });
        let payload;
        try { payload = await response.json(); }
        catch {
          if (response.status === 429) return { response, payload: null };
          throw new FeishuApiError(`飞书 API 返回非 JSON 响应（HTTP ${response.status}）`, { status: response.status, path: url.pathname });
        }
        return { response, payload };
      } catch (error) {
        if (error instanceof FeishuApiError) throw error;
        throw new FeishuApiError('无法连接飞书 API，请检查网络或稍后重试。', { code: 'NETWORK_ERROR', path: url.pathname });
      }
    })();
    try { return await Promise.race([operation, deadline]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
}

const ID_TYPES = { user_id_type: 'open_id', department_id_type: 'open_department_id' };

export class FeishuDirectory {
  constructor(client, { signal } = {}) {
    if (typeof client?.request !== 'function') throw new TypeError('client 必须实现 request');
    this.client = client;
    this.signal = signal;
    this.scopeNote = SCOPE_NOTE;
  }

  withSignal(signal) {
    return new FeishuDirectory(this.client, { signal });
  }

  async *_pages(path, query = {}) {
    const tokens = new Set();
    let pageToken;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      this.signal?.throwIfAborted();
      const result = await this.client.request(path, { signal: this.signal, query: { ...ID_TYPES, page_size: 50, ...query, page_token: pageToken } });
      this.signal?.throwIfAborted();
      const data = result?.data;
      if (!data || typeof data !== 'object' || typeof data.has_more !== 'boolean') {
        throw new DirectoryError('飞书分页响应格式未知，无法确认查询完整性。');
      }
      yield data;
      if (!data.has_more) return;
      const next = data.page_token;
      if (typeof next !== 'string' || !next.trim() || tokens.has(next)) {
        throw new DirectoryError('飞书分页 token 缺失或重复，已停止查询，未返回部分结果。');
      }
      tokens.add(next);
      pageToken = next;
    }
    throw new DirectoryError(`飞书分页超过 ${MAX_PAGES} 页上限，未返回部分结果。`);
  }

  async _items(path, query) {
    const items = [];
    for await (const data of this._pages(path, query)) {
      if (data.items !== undefined && !Array.isArray(data.items)) throw new DirectoryError('飞书分页 items 不是数组');
      for (const item of data.items || []) {
        items.push(item);
        assertScanLimit(items.length);
      }
    }
    return items;
  }

  async listDepartmentUsers(openDepartmentId) {
    const users = await this._items('/contact/v3/users/find_by_department', { department_id: departmentId(openDepartmentId) });
    for (const user of users) userId(user);
    return users;
  }

  async listDescendantDepartments(id) {
    const departments = await this._items(`/contact/v3/departments/${encodeURIComponent(departmentId(id))}/children`, { fetch_child: true });
    for (const department of departments) departmentId(department);
    return departments;
  }

  async getUser(openId) {
    this.signal?.throwIfAborted();
    if (typeof openId !== 'string' || !openId.trim()) throw new TypeError('open_id 不能为空');
    const result = await this.client.request(`/contact/v3/users/${encodeURIComponent(openId.trim())}`, { signal: this.signal, query: ID_TYPES });
    this.signal?.throwIfAborted();
    const user = result?.data?.user;
    if (userId(user) !== openId.trim()) throw new DirectoryError('飞书返回的 open_id 与请求不一致');
    return user;
  }

  async listAllUsers() {
    const directUsers = new Set();
    const roots = new Set();
    let scopeCount = 0;
    // Official scopes: root children + direct users for all-staff access; selected
    // departments (without descendants), standalone users and groups otherwise.
    // Missing arrays can mean missing field permission, not an empty scope.
    for await (const data of this._pages('/contact/v3/scopes', { page_size: 100 })) {
      const known = new Set(['user_ids', 'department_ids', 'group_ids', 'has_more', 'page_token']);
      if (Object.keys(data).some(key => !known.has(key)) ||
          !['user_ids', 'department_ids', 'group_ids'].every(key => Array.isArray(data[key]))) {
        throw new DirectoryError('通讯录授权范围未知或字段缺失，无法保证完整扫描；请检查通讯录范围及 contact:user.employee_id:readonly 权限。');
      }
      if (data.group_ids.length) throw new DirectoryError('通讯录授权范围包含用户组 group_ids，当前不支持展开用户组；请改为部门及成员授权后重试，未返回部分结果。');
      for (const key of ['user_ids', 'department_ids']) {
        for (const id of data[key]) {
          if (typeof id !== 'string' || !id.trim()) throw new DirectoryError('通讯录授权范围包含无效 ID，无法保证完整扫描。');
          (key === 'user_ids' ? directUsers : roots).add(id.trim());
          assertScanLimit(++scopeCount);
        }
      }
    }
    const departments = new Set(roots);
    for (const id of roots) {
      this.signal?.throwIfAborted();
      for (const department of await this.listDescendantDepartments(id)) {
        this.signal?.throwIfAborted();
        departments.add(departmentId(department));
        assertScanLimit(departments.size);
      }
    }
    const users = new Map();
    let scanned = 0;
    const add = user => {
      this.signal?.throwIfAborted();
      assertScanLimit(++scanned);
      const id = userId(user);
      if (!users.has(id)) users.set(id, user);
    };
    for (const id of directUsers) {
      this.signal?.throwIfAborted();
      add(await this.getUser(id));
    }
    for (const id of departments) {
      this.signal?.throwIfAborted();
      for (const user of await this.listDepartmentUsers(id)) add(user);
    }
    this.signal?.throwIfAborted();
    return [...users.values()];
  }
}
