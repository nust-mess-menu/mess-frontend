import Link from "next/link";
import Footer from "@/components/site/Footer";
import Navbar from "@/components/site/Navbar";

export const metadata = { title: "Page not found - Mess Menu - NUST Hostels" };

export default function NotFound() {
  return (
    <div className="site-shell">
      <Navbar />
      <main className="site-main">
      <div className="container my-4">
        <div className="alert alert-info" role="alert">
          <h4 className="alert-heading">Page not found</h4>
          <p>That page doesn&apos;t exist. The menu is one tap away.</p>
          <Link className="btn btn-primary" href="/">
            Today&apos;s menu
          </Link>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
}
