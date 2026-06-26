export type PosRole = "cajero" | "jefa";

export type PosPermission =
  | "sales.view"
  | "sales.complete"
  | "sales.summary"
  | "sales.history"
  | "sales.cancel.request"
  | "sales.cancel.approve"
  | "accounts.fatherTab"
  | "cash.closeout"
  | "cash.closeout.review"
  | "products.admin"
  | "products.create"
  | "products.edit"
  | "products.delete"
  | "products.toggleActive"
  | "products.viewCost"
  | "products.viewProfit"
  | "finance.viewAdvanced";

type PermissionMap = Record<PosPermission, boolean>;

const cashierPermissions: PermissionMap = {
  "sales.view": true,
  "sales.complete": true,
  "sales.summary": true,
  "sales.history": false,
  "sales.cancel.request": true,
  "sales.cancel.approve": false,
  "accounts.fatherTab": true,
  "cash.closeout": true,
  "cash.closeout.review": false,
  "products.admin": false,
  "products.create": false,
  "products.edit": false,
  "products.delete": false,
  "products.toggleActive": false,
  "products.viewCost": false,
  "products.viewProfit": false,
  "finance.viewAdvanced": false
};

const bossPermissions: PermissionMap = {
  "sales.view": true,
  "sales.complete": true,
  "sales.summary": true,
  "sales.history": true,
  "sales.cancel.request": true,
  "sales.cancel.approve": true,
  "accounts.fatherTab": true,
  "cash.closeout": true,
  "cash.closeout.review": true,
  "products.admin": true,
  "products.create": true,
  "products.edit": true,
  "products.delete": true,
  "products.toggleActive": true,
  "products.viewCost": true,
  "products.viewProfit": true,
  "finance.viewAdvanced": true
};

export const posRoles: PosRole[] = ["cajero", "jefa"];

export const roleLabels: Record<PosRole, string> = {
  cajero: "Cajera",
  jefa: "Jefa"
};

export function getRolePermissions(role: PosRole): PermissionMap {
  return role === "jefa" ? bossPermissions : cashierPermissions;
}

export function formatRoleLabel(role: PosRole) {
  return roleLabels[role];
}

export function formatProfileIdentity(
  role: PosRole,
  fullName: string | null | undefined,
  email?: string | null
) {
  if (role === "jefa") {
    const normalizedName = fullName?.trim() === "Angie" ? "Anyi" : fullName?.trim();

    return normalizedName?.length ? normalizedName : "Jefa";
  }

  if (email?.trim().toLowerCase() === "cajera1@xiomycafe.com") {
    return "Deisy";
  }

  const normalizedName = fullName?.trim();

  if (normalizedName && normalizedName.toLowerCase() !== "cajera") {
    return normalizedName;
  }

  return "Cajera";
}

export function getProfileTheme(role: PosRole) {
  return role === "jefa" ? "jefa" : "cajera";
}

export function isPosRole(value: string): value is PosRole {
  return value === "cajero" || value === "jefa";
}
