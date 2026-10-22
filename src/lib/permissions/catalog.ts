/**
 * The permission catalog and the role templates shipped with EduOS.
 * Templates are copied into the database by the seed; organizations can then create custom roles
 * from the same permission keys without code changes.
 */

export const PERMISSIONS = {
  // Organization & settings
  "org.read": { module: "organization", description: "View organization and school list" },
  "schools.manage": { module: "organization", description: "Create and configure schools" },
  "settings.manage": { module: "organization", description: "Manage school settings and academic years" },
  "users.read": { module: "identity", description: "View staff accounts and roles" },
  "users.manage": { module: "identity", description: "Invite users, assign roles, suspend accounts" },
  "audit.read": { module: "identity", description: "Read the audit log" },
  // Students & families
  "students.read": { module: "students", description: "View student records" },
  "students.create": { module: "students", description: "Create students" },
  "students.update": { module: "students", description: "Edit student records" },
  "students.archive": { module: "students", description: "Change student status (withdraw, alumni)" },
  "guardians.manage": { module: "students", description: "Create guardians and link them to students" },
  "enrollment.manage": { module: "students", description: "Enroll students in sections" },
  // Academics
  "academics.read": { module: "academics", description: "View classes, sections and timetables" },
  "attendance.read": { module: "attendance", description: "View attendance" },
  "attendance.mark": { module: "attendance", description: "Mark and submit attendance" },
  "attendance.correct": { module: "attendance", description: "Approve attendance corrections" },
  // Fees & finance
  "fees.read": { module: "fees", description: "View fee structures, invoices and payments" },
  "fees.configure": { module: "fees", description: "Create fee structures and categories" },
  "fees.assign": { module: "fees", description: "Assign fees to students and issue invoices" },
  "fees.collect": { module: "fees", description: "Record payments and issue receipts" },
  "fees.reverse": { module: "fees", description: "Reverse a recorded payment" },
  "fees.discount.approve": { module: "fees", description: "Approve concessions and discounts" },
  "finance.ledger.read": { module: "finance", description: "View ledger accounts and journal entries" },
  "finance.ledger.create": { module: "finance", description: "Create manual journal entries" },
  "finance.ledger.update": { module: "finance", description: "Reverse journal entries" },
  "finance.reconcile": { module: "finance", description: "Mark payments verified against bank records" },
  // Reporting & AI
  "reports.read": { module: "reports", description: "View operational reports and dashboards" },
  "reports.export": { module: "reports", description: "Export reports as CSV" },
  "ai.query": { module: "ai", description: "Use AI assistants" },
  "ai.actions.approve": { module: "ai", description: "Approve AI-proposed actions" },
  // Family-facing
  "family.read": { module: "family", description: "View linked children (parents)" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type Scope = "ORGANIZATION" | "SCHOOL" | "ASSIGNED" | "OWN_FAMILY" | "SELF";

type Template = {
  key: string;
  name: string;
  description: string;
  /** Default assignment level: org-wide roles are assigned with schoolId = null. */
  level: "organization" | "school";
  permissions: Partial<Record<PermissionKey, Scope>>;
};

const allWith = (scope: Scope, keys: PermissionKey[]) => Object.fromEntries(keys.map((k) => [k, scope])) as Partial<Record<PermissionKey, Scope>>;

const SCHOOL_OPERATIONS: PermissionKey[] = [
  "org.read", "users.read", "students.read", "academics.read", "attendance.read", "fees.read", "reports.read",
];

export const ROLE_TEMPLATES: Template[] = [
  {
    key: "platform_admin", name: "Platform Administrator", level: "organization",
    description: "EduOS operator. Configures organizations and schools.",
    permissions: allWith("ORGANIZATION", ["org.read", "schools.manage", "settings.manage", "users.read", "users.manage", "audit.read"]),
  },
  {
    key: "org_owner", name: "Organization Owner", level: "organization",
    description: "Group owner. Full visibility across schools and designated finance authority.",
    permissions: allWith("ORGANIZATION", [
      ...SCHOOL_OPERATIONS, "schools.manage", "settings.manage", "users.manage", "audit.read",
      "students.create", "students.update", "students.archive", "guardians.manage", "enrollment.manage",
      "attendance.correct", "fees.configure", "fees.assign", "fees.discount.approve",
      "finance.ledger.read", "finance.ledger.create", "finance.ledger.update", "finance.reconcile",
      "reports.export", "ai.query", "ai.actions.approve",
    ]),
  },
  {
    key: "group_admin", name: "Group Administrator", level: "organization",
    description: "Central administration across schools. No ledger write access.",
    permissions: allWith("ORGANIZATION", [
      ...SCHOOL_OPERATIONS, "settings.manage", "users.manage", "audit.read",
      "students.create", "students.update", "guardians.manage", "enrollment.manage", "reports.export", "ai.query",
    ]),
  },
  {
    key: "school_management", name: "School Management", level: "school",
    description: "School owner or trustee view of one school.",
    permissions: allWith("SCHOOL", [...SCHOOL_OPERATIONS, "finance.ledger.read", "reports.export", "audit.read", "ai.query"]),
  },
  {
    key: "principal", name: "Principal", level: "school",
    description: "Head of school. Operational oversight and approvals.",
    permissions: allWith("SCHOOL", [
      ...SCHOOL_OPERATIONS, "settings.manage", "students.create", "students.update", "students.archive",
      "guardians.manage", "enrollment.manage", "attendance.mark", "attendance.correct", "fees.discount.approve",
      "reports.export", "audit.read", "ai.query", "ai.actions.approve",
    ]),
  },
  {
    key: "vice_principal", name: "Vice Principal / Academic Coordinator", level: "school",
    description: "Academic oversight.",
    permissions: allWith("SCHOOL", [...SCHOOL_OPERATIONS, "students.update", "attendance.mark", "attendance.correct", "ai.query"]),
  },
  {
    key: "teacher", name: "Teacher", level: "school",
    description: "Teaches assigned sections. Access limited to those sections.",
    permissions: {
      "org.read": "SCHOOL", "academics.read": "SCHOOL",
      "students.read": "ASSIGNED", "attendance.read": "ASSIGNED", "attendance.mark": "ASSIGNED", "ai.query": "ASSIGNED",
    },
  },
  {
    key: "admissions_officer", name: "Admissions Officer", level: "school",
    description: "Admissions pipeline and new student records.",
    permissions: allWith("SCHOOL", ["org.read", "academics.read", "students.read", "students.create", "guardians.manage", "enrollment.manage"]),
  },
  {
    key: "accounts_admin", name: "Accounts Administrator", level: "school",
    description: "Finance lead. Fee configuration, ledger and reconciliation.",
    permissions: allWith("SCHOOL", [
      "org.read", "academics.read", "students.read", "fees.read", "fees.configure", "fees.assign", "fees.collect",
      "fees.reverse", "finance.ledger.read", "finance.ledger.create", "finance.ledger.update", "finance.reconcile",
      "reports.read", "reports.export",
    ]),
  },
  {
    key: "accountant", name: "Accountant / Cashier", level: "school",
    description: "Records collections and issues receipts.",
    permissions: allWith("SCHOOL", ["org.read", "academics.read", "students.read", "fees.read", "fees.assign", "fees.collect", "finance.ledger.read", "reports.read"]),
  },
  {
    key: "front_office", name: "Front Office / Reception", level: "school",
    description: "Look up students and guardians.",
    permissions: allWith("SCHOOL", ["org.read", "academics.read", "students.read"]),
  },
  { key: "hr_admin", name: "HR Administrator", level: "school", description: "Staff records (HR module pending).", permissions: allWith("SCHOOL", ["org.read", "users.read"]) },
  { key: "transport_manager", name: "Transport Manager", level: "school", description: "Transport (module pending).", permissions: allWith("SCHOOL", ["org.read", "students.read"]) },
  { key: "hostel_warden", name: "Hostel Warden", level: "school", description: "Hostel (module pending).", permissions: allWith("SCHOOL", ["org.read", "students.read"]) },
  { key: "librarian", name: "Librarian", level: "school", description: "Library (module pending).", permissions: allWith("SCHOOL", ["org.read"]) },
  { key: "helpdesk", name: "Support / Helpdesk", level: "school", description: "Tickets (module pending).", permissions: allWith("SCHOOL", ["org.read"]) },
  {
    key: "parent", name: "Parent / Guardian", level: "organization",
    description: "Sees only children explicitly linked to their guardian record.",
    permissions: allWith("OWN_FAMILY", ["family.read", "students.read", "attendance.read", "fees.read"]),
  },
  {
    key: "student", name: "Student", level: "school",
    description: "Own records only (student app pending).",
    permissions: allWith("SELF", ["attendance.read"]),
  },
];
