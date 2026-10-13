import Link from "next/link";
import Footer from "@/components/site/Footer";
import Navbar from "@/components/site/Navbar";
import { ALERT_INFO, BTN_PRIMARY, CONTAINER, SHELL, SHELL_MAIN } from "@/components/site/shellClasses";

export const metadata = { title: "Page not found - Mess Menu - NUST Hostels" };

export default function NotFound() {
  return (
    <div className={SHELL}>
      <Navbar />
      <main className={SHELL_MAIN}>
        <div className={`${CONTAINER} my-6`}>
          <div className={ALERT_INFO} role="alert">
            <h4>Page not found</h4>
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
