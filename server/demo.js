// Fixed fictional contacts only. No production credentials or real employee data.
export const demoDepartments = [
  { open_department_id: 'od-demo-rd', name: '产品研发', parent_department_id: '0' },
  { open_department_id: 'od-demo-product', name: '产品组', parent_department_id: 'od-demo-rd' },
  { open_department_id: 'od-demo-engineering', name: '工程组', parent_department_id: 'od-demo-rd' },
];

export const demoContacts = [
  { open_id: 'ou-demo-linxiao', name: '林晓', employee_no: 'E1001', enterprise_email: 'lin.xiao@example.com', department_ids: ['od-demo-product'], status: { is_activated: true } },
  { open_id: 'ou-demo-chenyu', name: '陈予', employee_no: 'E1002', enterprise_email: 'chen.yu@example.com', department_ids: ['od-demo-engineering'], status: { is_activated: true } },
  { open_id: 'ou-demo-zhouning', name: '周宁', employee_no: 'E1003', enterprise_email: '', department_ids: ['od-demo-product'], status: { is_activated: true } },
  { open_id: 'ou-demo-xuyan', name: '许言', employee_no: 'E1004', enterprise_email: 'xu.yan@example.com', department_ids: ['od-demo-engineering'], status: { is_activated: true } },
];

export function createDemoDirectory() {
  const contacts = structuredClone(demoContacts);
  const departments = structuredClone(demoDepartments);
  const ensureDepartment = id => {
    if (id !== '0' && !departments.some(department => department.open_department_id === id)) {
      throw new Error(`演示部门不存在：${id}`);
    }
  };
  return {
    scopeNote: '演示数据：所有姓名、工号与邮箱均为虚构，仅用于体验；不会连接真实飞书通讯录。',
    async listAllUsers() { return structuredClone(contacts); },
    async getUser(id) { return structuredClone(contacts.find(user => user.open_id === id) || null); },
    async listDepartmentUsers(id) {
      ensureDepartment(id);
      return structuredClone(contacts.filter(user => user.department_ids.includes(id)));
    },
    async listDescendantDepartments(id) {
      ensureDepartment(id);
      const seen = new Set([id]);
      const result = [];
      for (const parent of seen) {
        for (const department of departments) {
          if (department.parent_department_id === parent && !seen.has(department.open_department_id)) {
            seen.add(department.open_department_id);
            result.push(department);
          }
        }
      }
      return structuredClone(result);
    },
  };
}
