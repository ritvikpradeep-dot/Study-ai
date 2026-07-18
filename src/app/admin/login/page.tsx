"use client";

import { LoginForm } from "@/components/login-form";

export default function AdminLoginPage() {
  return (
    <LoginForm
      title="Admin sign in"
      subtitle="Restricted to StudyAI admin accounts."
      callbackUrl="/admin"
      requireAdmin
      showSignupLink={false}
      showGoogle={false}
    />
  );
}
