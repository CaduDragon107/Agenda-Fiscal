import Image from "next/image";
import { LoginForm } from "./login-form";

const BACKGROUNDS = ["/login-bg-1.jpg", "/login-bg-2.png"];

export default function LoginPage() {
  const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src={background}
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative w-full max-w-[400px] px-4">
        <LoginForm />
      </div>
    </main>
  );
}
