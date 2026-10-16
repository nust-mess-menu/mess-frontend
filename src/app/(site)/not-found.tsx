import Link from "next/link";
import Footer from "@/components/site/Footer";
import Navbar from "@/components/site/Navbar";
import { ALERT_INFO, BTN_PRIMARY, CONTAINER, SHELL, SHELL_MAIN } from "@/components/site/shellClasses";

export const metadata = { title: { absolute: "Page not found - NUST Mess Menu" }, robots: { index: false } };

export default function NotFound() {
  return (
    <div className={SHELL}>
      <Navbar />
      <main className={SHELL_MAIN}>
        <div className={`${CONTAINER} my-6`}>
          <div className={ALERT_INFO} role="alert">
            <h1 className="mb-2 text-[1.5rem]">Page not found</h1>
            <p>That page doesn&apos;t exist. The menu is one tap away.</p>
            <Link className={BTN_PRIMARY} href="/">
              Today&apos;s menu
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
