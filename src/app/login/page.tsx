import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center pt-16">
      <div className="w-full max-w-[400px] px-4">
        <LoginForm />
      </div>
    </main>
  );
}
