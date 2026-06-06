import type { PosRole } from "@/lib/pos-permissions";

export type DemoUser = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: PosRole;
};

export const demoUsers: DemoUser[] = [
  {
    username: "jefa1",
    email: "jefa1@xiomycafe.com",
    password: "abc123",
    fullName: "Xiomy",
    role: "jefa"
  },
  {
    username: "jefa2",
    email: "jefa2@xiomycafe.com",
    password: "abc123",
    fullName: "Angie",
    role: "jefa"
  },
  {
    username: "cajera1",
    email: "cajera1@xiomycafe.com",
    password: "abc123",
    fullName: "Cajera",
    role: "cajero"
  },
  {
    username: "cajera2",
    email: "cajera2@xiomycafe.com",
    password: "abc123",
    fullName: "Cajera",
    role: "cajero"
  }
];

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
