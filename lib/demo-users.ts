import type { PosRole } from "@/lib/pos-permissions";
import managedUsers from "@/config/managed-users.json";

export type DemoUser = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: PosRole;
};

export const demoUsers: DemoUser[] = managedUsers as DemoUser[];

export function findDemoUserByEmail(email: string) {
  return demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findDemoUserByLogin(login: string) {
  const normalized = login.trim().toLowerCase();

  return (
    demoUsers.find(
      (user) =>
        user.username.toLowerCase() === normalized || user.email.toLowerCase() === normalized
    ) ?? null
  );
}
