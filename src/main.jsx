import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, CheckCheck, ChevronRight, CircleAlert, Copy, FileText, FolderTree, HelpCircle, LoaderCircle, Mail, Search, ShieldCheck, Users, X } from 'lucide-react';
import { api, chooseFeishuContacts, loginFeishu } from './feishu.js';
import './styles.css';

const unique = values => [...new Set(values)];
const parseNumbers = text => unique(text.split(/\r?\n/).map(value => value.trim()).filter(Boolean));
const Icon = ({ icon: Component, ...props }) => <Component size={18} strokeWidth={1.8} aria-hidden="true" {...props} />;
function navigateTabs(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')];
  if (!tabs.length) return;
  const index = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next].focus(); tabs[next].click();
}

function DemoPicker({ contacts, departments, selected, onClose, onConfirm }) {
  const dialog = useRef(null);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(selected.users.map(item => item.id));
  const [depts, setDepts] = useState(selected.departments.map(item => item.id));
  useEffect(() => { dialog.current.showModal(); }, []);
  const toggle = (value, list, set) => set(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  const q = query.trim().toLocaleLowerCase();
  const shownUsers = contacts.filter(user => `${user.name} ${user.employee_no}`.toLocaleLowerCase().includes(q));
  const shownDepartments = departments.filter(department => department.name.toLocaleLowerCase().includes(q));
  return <dialog ref={dialog} className="picker-dialog" aria-labelledby="picker-title" onCancel={onClose}>
    <div className="dialog-heading"><div><h2 id="picker-title">选择成员或部门</h2><p>演示通讯录 · 以下均为虚构数据</p></div><button className="icon-button" onClick={onClose} aria-label="关闭选择器"><Icon icon={X} /></button></div>
    <div className="picker-search"><Icon icon={Search} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索姓名、工号或部门" aria-label="搜索演示通讯录" /></div>
    <div className="picker-list">
      {shownDepartments.length > 0 && <><h3>部门</h3>{shownDepartments.map(department => <label className="picker-row" key={department.open_department_id}>
        <input type="checkbox" checked={depts.includes(department.open_department_id)} onChange={() => toggle(department.open_department_id, depts, setDepts)} />
        <Icon icon={FolderTree} /><span>{department.name}<small>{department.parent_department_id && department.parent_department_id !== '0' ? '子部门' : '部门'}</small></span>
      </label>)}</>}
      {shownUsers.length > 0 && <><h3>成员</h3>{shownUsers.map(user => <label className="picker-row" key={user.open_id}>
        <input type="checkbox" checked={users.includes(user.open_id)} onChange={() => toggle(user.open_id, users, setUsers)} />
        <span className="avatar" aria-hidden="true">{user.name.slice(-2)}</span><span>{user.name}<small>{user.employee_no}</small></span>
      </label>)}</>}
      {!shownDepartments.length && !shownUsers.length && <p className="no-matches">没有找到匹配项，试试其他姓名或工号。</p>}
    </div>
    <div className="dialog-footer"><span>已选 {users.length} 人、{depts.length} 个部门</span><button className="button primary" onClick={() => onConfirm({
      users: contacts.filter(user => users.includes(user.open_id)).map(user => ({ id: user.open_id, name: user.name })),
      departments: departments.filter(department => depts.includes(department.open_department_id)).map(department => ({ id: department.open_department_id, name: department.name })),
    })}>确认选择<Icon icon={Check} /></button></div>
  </dialog>;
}

function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [mode, setMode] = useState('numbers');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState({ users: [], departments: [] });
  const [includeChildren, setIncludeChildren] = useState(true);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [details, setDetails] = useState('issues');
  const output = useRef(null);
  const copyTimer = useRef(null);
  const resultHeading = useRef(null);
  const numbers = parseNumbers(text);
  const demo = bootstrap?.mode === 'demo';
  const ready = !!bootstrap && (demo || bootstrap.authenticated);
  const maxNumbers = bootstrap?.limits?.employeeNumbers || 1000;
  const overLimit = numbers.length > maxNumbers;
  const inputCount = mode === 'numbers' ? numbers.length : selected.users.length + selected.departments.length;

  useEffect(() => { api('/api/bootstrap').then(setBootstrap).catch(err => setError(err.message)); return () => clearTimeout(copyTimer.current); }, []);
  function invalidate() { setResult(null); setCopied(false); setCopyError(''); setError(''); }
  function fail(err) {
    setError(err.message);
    if (err.status === 401) { setBootstrap(previous => previous && { ...previous, authenticated: false }); setResult(null); }
  }
  async function login() {
    setAuthBusy(true); setError('');
    try { setBootstrap(await loginFeishu(bootstrap.appId)); } catch (err) { fail(err); } finally { setAuthBusy(false); }
  }
  async function choose() {
    if (demo) return setPicker(true);
    setPicking(true); setError('');
    try {
      const next = await chooseFeishuContacts(selected.users);
      if (next) {
        // Native API only supports member preselection. Keep prior departments until explicitly removed.
        const departments = [...new Map([...selected.departments, ...next.departments].map(item => [item.id, item])).values()];
        setSelected({ users: [...new Map(next.users.map(item => [item.id, item])).values()], departments });
        invalidate();
      }
    } catch (err) { fail(err); } finally { setPicking(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!inputCount || busy || overLimit && mode === 'numbers' || !ready) return;
    setBusy(true); invalidate();
    try {
      const next = mode === 'numbers'
        ? await api('/api/resolve/employee-numbers', { numbers })
        : await api('/api/resolve/selection', { userIds: selected.users.map(user => user.id), departmentIds: selected.departments.map(department => department.id), includeChildren });
      setResult(next); setDetails(next.issues.length ? 'issues' : 'matched');
      // Keep keyboard users oriented without shifting the scroll position on desktop.
      requestAnimationFrame(() => resultHeading.current?.focus({ preventScroll: true }));
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function copy() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      output.current?.focus(); output.current?.select();
      setCopyError('浏览器未允许自动复制，已选中邮箱，请按 Ctrl+C（Mac 使用 ⌘C），手机可长按复制。');
    }
  }
  function removeSelection(kind, id) { setSelected(previous => ({ ...previous, [kind]: previous[kind].filter(item => item.id !== id) })); invalidate(); }
  const limitSelected = selected.users.length > 1000 || selected.departments.length > 100;

  return <>
    <header className="topbar"><div className="topbar-inner"><a className="brand" href="/" aria-label="邮箱助手首页"><span className="brand-icon"><Icon icon={Mail} size={23} /></span><span>邮箱助手</span></a><span className="topbar-divider" /><span className="brand-context">飞书通讯录工具</span><span className="environment">{!bootstrap ? '正在连接服务' : demo ? '演示环境' : '企业应用'}</span></div></header>
    <main>
      <div className="page-heading"><div><h1>把同事名单，变成邮箱集合。</h1><p>按工号查询，或直接选择成员与部门。整理好，复制即可使用。</p></div><div className="privacy-note"><Icon icon={ShieldCheck} /><span>不保存查询历史</span></div></div>
      {demo && <div className="notice demo-notice"><Icon icon={CircleAlert} /><span><strong>当前为演示模式</strong> · 仅使用虚构通讯录，不会访问企业数据。真实环境使用飞书原生选择器。</span><a href="#usage">接入说明<Icon icon={ChevronRight} size={14} /></a></div>}
      {bootstrap && !demo && !bootstrap.authenticated && <div className="notice auth-notice"><Icon icon={ShieldCheck} /><span><strong>先登录飞书，再查询企业通讯录</strong><br />请在飞书客户端中打开此应用。查询范围由管理员授权决定。</span><button className="button primary" onClick={login} disabled={authBusy}>{authBusy && <Icon icon={LoaderCircle} className="spin" />}{authBusy ? '正在授权…' : '登录飞书'}</button></div>}
      {bootstrap?.authenticated && !demo && <div className="session-line"><Icon icon={CheckCheck} /><span>{bootstrap.user?.name || '飞书成员'}，已登录</span><button className="text-button" disabled={busy || picking} onClick={async () => { try { await api('/api/auth/logout', {}); setBootstrap(await api('/api/bootstrap')); setText(''); setSelected({ users: [], departments: [] }); invalidate(); } catch (err) { fail(err); } }}>退出</button></div>}
      {error && <div className="notice error-notice" role="alert"><Icon icon={CircleAlert} /><span>{error}</span>{!bootstrap && <button className="text-button" onClick={() => { setError(''); api('/api/bootstrap').then(setBootstrap).catch(fail); }}>重新连接</button>}<button className="icon-button" onClick={() => setError('')} aria-label="关闭错误提示"><Icon icon={X} size={16} /></button></div>}
      <div className="workspace" aria-busy={busy}>
        <section className="input-panel" aria-labelledby="input-title">
          <div className="section-heading"><h2 id="input-title">选择查询方式</h2><span className="section-note">两种方式，同一份结果</span></div>
          <div className="mode-tabs" role="tablist" onKeyDown={navigateTabs} aria-label="查询方式">
            <button type="button" role="tab" id="tab-numbers" aria-controls="input-content" aria-selected={mode === 'numbers'} disabled={busy || picking} onClick={() => { setMode('numbers'); invalidate(); }}><Icon icon={FileText} />按工号查询</button>
            <button type="button" role="tab" id="tab-people" aria-controls="input-content" aria-selected={mode === 'people'} disabled={busy || picking} onClick={() => { setMode('people'); invalidate(); }}><Icon icon={Users} />选择成员 / 部门</button>
          </div>
          <form onSubmit={submit} id="input-content" role="tabpanel" aria-labelledby={mode === 'numbers' ? 'tab-numbers' : 'tab-people'}>
            {mode === 'numbers' ? <>
              <div className="field-heading"><label htmlFor="employee-numbers">工号列表</label>{demo && <button className="text-button" type="button" disabled={busy} onClick={() => { setText('E1001\nE1002\nE1003\nE1004'); invalidate(); }}>填入示例</button>}</div>
              <p className="field-hint" id="numbers-hint">一行一个，最多 {maxNumbers.toLocaleString()} 个。保留前导零，自动忽略空行和重复工号。</p>
              <textarea id="employee-numbers" className="number-input" placeholder={'在此粘贴工号，例如：\nE1001\nE1002\nE1003'} value={text} onChange={event => { setText(event.target.value); invalidate(); }} disabled={busy} aria-describedby="numbers-hint input-count" aria-invalid={overLimit} spellCheck={false} maxLength={64000} />
              <div className="input-meta"><span id="input-count" className={overLimit ? 'error-text' : ''}>已输入 <strong>{numbers.length}</strong> 个不同工号{overLimit && `，请减少至 ${maxNumbers} 个以内`}</span><button className="text-button" type="button" disabled={!text || busy} onClick={() => { setText(''); invalidate(); }}>清空</button></div>
            </> : <>
              <div className="field-heading"><label>成员与部门</label>{inputCount > 0 && <button className="text-button" type="button" disabled={busy || picking} onClick={() => { setSelected({ users: [], departments: [] }); invalidate(); }}>清空选择</button>}</div>
              <p className="field-hint">可同时选择多个成员和部门，重复出现的人员只计一次。</p>
              <button type="button" className="choose-button" onClick={choose} disabled={!ready || busy || picking}><Icon icon={picking ? LoaderCircle : Users} className={picking ? 'spin' : ''} /><span>{picking ? '正在打开选择器…' : demo ? '打开演示通讯录' : '打开飞书成员选择器'}</span><Icon icon={ChevronRight} /></button>
              <div className={`selection-area ${inputCount ? 'has-selection' : ''}`}>
                {!inputCount ? <div className="selection-empty"><Icon icon={FolderTree} size={28} /><span>还没有选择成员或部门</span><small>选定部门后，服务端会展开成员名单</small></div> : <>
                  {selected.departments.length > 0 && <div className="selected-group"><span className="selected-label">部门 · {selected.departments.length}</span><div className="chips">{selected.departments.map(item => <span className="chip department-chip" key={item.id}><Icon icon={FolderTree} size={14} /><span title={item.name}>{item.name}</span><button type="button" disabled={busy || picking} onClick={() => removeSelection('departments', item.id)} aria-label={`移除部门 ${item.name}`}><Icon icon={X} size={14} /></button></span>)}</div></div>}
                  {selected.users.length > 0 && <div className="selected-group"><span className="selected-label">成员 · {selected.users.length}</span><div className="chips">{selected.users.map(item => <span className="chip" key={item.id}><span title={item.name}>{item.name}</span><button type="button" disabled={busy || picking} onClick={() => removeSelection('users', item.id)} aria-label={`移除成员 ${item.name}`}><Icon icon={X} size={14} /></button></span>)}</div></div>}
                </>}
              </div>
              <label className="checkbox-label"><input type="checkbox" checked={includeChildren} disabled={busy} onChange={event => { setIncludeChildren(event.target.checked); invalidate(); }} /><span>包含所选部门的全部子部门</span></label>
              {!demo && <p className="field-hint">已选部门会保留；如需取消，请点击上方部门标签的移除按钮。</p>}
              {limitSelected && <p className="error-text" role="alert">最多选择 1,000 位成员和 100 个部门，请减少选择。</p>}
            </>}
            <button className="button primary submit-button" type="submit" disabled={!ready || !inputCount || busy || picking || (mode === 'numbers' ? overLimit : limitSelected)}><Icon icon={busy ? LoaderCircle : Search} className={busy ? 'spin' : ''} />{busy ? '正在查询通讯录…' : '查询企业邮箱'}{!busy && <Icon icon={ArrowRight} />}</button>
            <p className="input-footnote"><Icon icon={ShieldCheck} size={14} />仅查询应用获准访问的通讯录范围</p>
          </form>
        </section>
        <section className="result-panel" aria-labelledby="result-title">
          <div className="section-heading"><h2 id="result-title" ref={resultHeading} tabIndex={-1}>邮箱集合{result && <span className="count-label">{result.emails.length}</span>}</h2><span className="section-note">去重 · 空格分隔</span></div>
          {!result ? <div className="result-empty" aria-live="polite"><div className="empty-symbol"><Icon icon={busy ? LoaderCircle : Mail} size={33} className={busy ? 'spin' : ''} /></div><h3>{busy ? '正在整理邮箱' : '邮箱会整理在这里'}</h3><p>{busy ? '正在匹配成员并展开部门，请稍候。' : '从左侧输入工号或选择成员，\n查询后即可一键复制。'}</p><div className="format-example"><span>输出格式</span><code>name@example.com other@example.com</code></div></div> : <>
            <div className="result-summary" role="status"><span>输入 <strong>{result.stats.requested}</strong> 项</span><Icon icon={ChevronRight} size={14} /><span>匹配 <strong>{result.stats.people}</strong> 人</span><Icon icon={ChevronRight} size={14} /><span className="summary-final"><strong>{result.emails.length}</strong> 个邮箱</span></div>
            <div className="output-wrap"><label htmlFor="email-output" className="sr-only">空格分隔的邮箱集合</label><textarea id="email-output" ref={output} readOnly value={result.text} placeholder="没有可导出的企业邮箱，请查看下方明细。" spellCheck={false} /></div>
            <div className="copy-row"><span><Icon icon={CheckCheck} size={15} />已自动去重，无额外分隔符</span><button className={`button ${copied ? 'success-button' : 'primary'}`} onClick={copy} disabled={!result.emails.length}><Icon icon={copied ? Check : Copy} size={16} />{copied ? '已复制' : '复制邮箱'}</button></div>
            <span className="sr-only" role="status">{copied ? '邮箱集合已复制到剪贴板' : ''}</span>
            {copyError && <p className="copy-error" role="alert">{copyError}</p>}
            {result.issues.length > 0 && <div className="result-warning"><Icon icon={CircleAlert} size={17} /><span><strong>{result.issues.length} 项需要确认</strong>，未包含在邮箱集合中。</span></div>}
            <div className="detail-header"><div className="detail-tabs" role="tablist" onKeyDown={navigateTabs} aria-label="查询结果明细"><button role="tab" id="detail-issues" aria-selected={details === 'issues'} aria-controls="detail-content" onClick={() => setDetails('issues')}>待确认 <span>{result.issues.length}</span></button><button role="tab" id="detail-matched" aria-selected={details === 'matched'} aria-controls="detail-content" onClick={() => setDetails('matched')}>已匹配 <span>{result.matched.length}</span></button></div></div>
            <div className="detail-list" id="detail-content" role="tabpanel" aria-labelledby={`detail-${details}`}>
              {details === 'issues' ? result.issues.length ? result.issues.map((issue, index) => <div className="issue-row" key={`${issue.key}-${index}`}><Icon icon={CircleAlert} size={16} /><div><strong>{issue.name || issue.key}</strong>{issue.name && <code>{issue.key}</code>}<p>{issue.message}</p></div></div>) : <div className="details-clear"><Icon icon={CheckCheck} /><span>没有待确认项</span></div> : result.matched.length ? result.matched.map(person => <div className="matched-row" key={person.id}><div><strong>{person.name || person.employeeNo || '成员'}</strong><code>{person.employeeNo}</code></div><span>{person.email}</span></div>) : <p className="no-matches">没有匹配到可用的企业邮箱。</p>}
            </div>
            <p className="scope-note">{result.scopeNote}</p>
          </>}
        </section>
      </div>
      <section className="usage" id="usage" aria-labelledby="usage-title"><div className="usage-title"><Icon icon={HelpCircle} size={18} /><h2 id="usage-title">使用须知</h2></div><div className="usage-columns"><div><h3>只匹配企业邮箱</h3><p>工号对应飞书通讯录的 employee_no。仅输出 enterprise_email，不会以个人邮箱替代或猜测邮箱地址。</p></div><div><h3>部门自动展开，人员自动去重</h3><p>默认包含子部门。多人、多部门交叉选择时，邮箱仅保留一份；无邮箱、未匹配等情况会单独列出。</p></div><div><h3>{demo ? '接入你的企业' : '范围由管理员授权'}</h3><p>{demo ? '管理员需配置自建应用凭证、通讯录权限、安全域名与重定向 URL。完成部署后，在飞书工作台打开正式应用。' : '结果受应用通讯录权限与可见范围限制。无法访问的部门不会被静默忽略；如有疑问，请联系应用管理员。'}</p></div></div></section>
      <footer><span>邮箱助手</span><span>{demo ? '演示数据仅用于功能体验' : '企业邮箱仅用于获授权的内部工作，请勿外传'}</span></footer>
    </main>
    {picker && <DemoPicker contacts={bootstrap.demoContacts || []} departments={bootstrap.demoDepartments || []} selected={selected} onClose={() => setPicker(false)} onConfirm={next => { setSelected(next); setPicker(false); invalidate(); }} />}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
