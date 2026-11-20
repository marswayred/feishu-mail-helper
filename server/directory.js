// Only locally authored, non-PII integrity messages belong in this public error type.
export class DirectoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DirectoryError';
  }
}

export const MAX_SCAN = 25_000;
export const SCOPE_NOTE = '仅查询应用获授权可见的通讯录；未找到不代表该员工不存在。仅使用企业邮箱 enterprise_email，不使用个人邮箱。';

function inputList(value, name, limit) {
  if (!Array.isArray(value)) throw new TypeError(`${name} 必须为字符串数组`);
  if (value.length > limit) throw new RangeError(`${name} 最多支持 ${limit} 项`);
  const result = new Set();
  for (const item of value) {
    if (typeof item !== 'string') throw new TypeError(`${name} 必须为字符串数组（工号需保留前导零）`);
    const trimmed = item.trim();
    if (trimmed) result.add(trimmed);
  }
  return [...result];
}

export function assertScanLimit(count) {
  if (count > MAX_SCAN) throw new DirectoryError(`通讯录扫描超过 ${MAX_SCAN} 项上限，请缩小授权或选择范围；未返回部分结果。`);
}

export function userId(user) {
  if (!user || typeof user.open_id !== 'string' || !user.open_id.trim()) {
    throw new DirectoryError('通讯录用户缺少 open_id，无法可靠去重；请检查接口及字段权限。');
  }
  return user.open_id.trim();
}

export function departmentId(department) {
  const id = typeof department === 'string' ? department : department?.open_department_id;
  if (typeof id !== 'string' || !id.trim()) throw new DirectoryError('通讯录部门缺少 open_department_id，无法完整查询。');
  return id.trim();
}

function userList(users) {
  if (!Array.isArray(users)) throw new DirectoryError('通讯录 provider 未返回用户数组，查询未完成。');
  assertScanLimit(users.length);
  const map = new Map();
  for (const user of users) {
    const id = userId(user);
    if (!map.has(id)) map.set(id, user);
  }
  return [...map.values()];
}

function emptyResult(requested, provider) {
  return {
    emails: [], text: '', matched: [], issues: [],
    stats: { requested, people: 0, emails: 0, issues: 0 },
    scopeNote: provider.scopeNote || SCOPE_NOTE,
  };
}

function issue(result, key, reason, message, user) {
  result.issues.push({ key, ...(user?.name ? { name: user.name } : {}), reason, message });
}

// Deliberately a plain address validator, not a display-name/RFC mailbox parser.
function validEmail(email) {
  if (email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && local.length <= 64 &&
    /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    domain.includes('.') && domain.split('.').every(label =>
      label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function appendUser(result, key, user) {
  result.stats.people += 1;
  if (user.status?.is_resigned === true || user.status?.is_exited === true) {
    issue(result, key, 'resigned', '成员已离职或退出，未输出邮箱。', user);
    return;
  }
  if (user.status?.is_frozen === true || user.is_frozen === true) {
    issue(result, key, 'disabled', '成员已暂停使用，未输出邮箱。', user);
    return;
  }
  const email = typeof user.enterprise_email === 'string' ? user.enterprise_email.trim() : '';
  if (!email) {
    issue(result, key, 'missing_email', '未获取到企业邮箱；可能未配置飞书邮箱或缺少字段权限，不回退到个人邮箱。', user);
    return;
  }
  if (!validEmail(email)) {
    issue(result, key, 'invalid_email', '企业邮箱格式无效，未输出。', user);
    return;
  }
  result.matched.push({
    id: userId(user), name: user.name || '',
    employeeNo: typeof user.employee_no === 'string' ? user.employee_no.trim() : '', email,
  });
}

function finalize(result) {
  const seen = new Set();
  for (const { email } of result.matched) {
    const normalized = email.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.emails.push(email);
    }
  }
  result.text = result.emails.join(' ');
  result.stats.emails = result.emails.length;
  result.stats.issues = result.issues.length;
  return result;
}

export async function resolveEmployeeNumbers(provider, numbers) {
  provider.signal?.throwIfAborted();
  const requested = inputList(numbers, 'numbers', 1000);
  const result = emptyResult(requested.length, provider);
  if (!requested.length) return result;
  // A user_id is an opaque platform identifier, never an employee number.
  const users = userList(await provider.listAllUsers());
  provider.signal?.throwIfAborted();
  const index = new Map();
  for (const user of users) {
    const employeeNo = typeof user.employee_no === 'string' ? user.employee_no.trim() : '';
    if (!employeeNo) continue;
    if (!index.has(employeeNo)) index.set(employeeNo, []);
    index.get(employeeNo).push(user);
  }
  for (const number of requested) {
    const candidates = index.get(number) || [];
    if (candidates.length === 0) issue(result, number, 'not_found', '在应用授权可见范围内未找到此工号；请检查工号和通讯录/工号字段权限。');
    else if (candidates.length > 1) issue(result, number, 'ambiguous', '此工号对应多位成员，无法唯一确认，未输出邮箱。');
    else appendUser(result, number, candidates[0]);
  }
  return finalize(result);
}

export async function resolveSelection(provider, { userIds = [], departmentIds = [], includeChildren = true } = {}) {
  provider.signal?.throwIfAborted();
  const selectedUsers = inputList(userIds, 'userIds', 1000);
  const selectedDepartments = inputList(departmentIds, 'departmentIds', 100);
  if (typeof includeChildren !== 'boolean') throw new TypeError('includeChildren 必须为布尔值');
  const result = emptyResult(selectedUsers.length + selectedDepartments.length, provider);
  const users = new Map();
  let scanned = 0;
  function addUsers(items) {
    provider.signal?.throwIfAborted();
    if (!Array.isArray(items)) throw new DirectoryError('通讯录 provider 未返回用户数组，查询未完成。');
    scanned += items.length;
    assertScanLimit(scanned);
    for (const user of items) {
      const id = userId(user);
      if (!users.has(id)) users.set(id, user);
    }
  }
  for (const id of selectedUsers) {
    provider.signal?.throwIfAborted();
    const user = await provider.getUser(id);
    provider.signal?.throwIfAborted();
    if (user == null) issue(result, id, 'not_found', '在应用授权可见范围内未找到该成员。');
    else addUsers([user]);
  }
  const departments = new Set(selectedDepartments);
  if (includeChildren) {
    for (const id of selectedDepartments) {
      provider.signal?.throwIfAborted();
      const children = await provider.listDescendantDepartments(id);
      provider.signal?.throwIfAborted();
      if (!Array.isArray(children)) throw new DirectoryError('通讯录 provider 未返回部门数组，查询未完成。');
      assertScanLimit(children.length);
      for (const child of children) departments.add(departmentId(child));
      assertScanLimit(departments.size);
    }
  }
  for (const id of departments) {
    provider.signal?.throwIfAborted();
    addUsers(await provider.listDepartmentUsers(id));
  }
  provider.signal?.throwIfAborted();
  for (const [id, user] of users) appendUser(result, id, user);
  return finalize(result);
}
