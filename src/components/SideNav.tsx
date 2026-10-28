"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href.split("/").length <= 2 ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label={label} className="lg:sticky lg:top-20 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                active(i.href) ? "bg-indigo text-white" : "text-ink-soft hover:bg-wash hover:text-ink"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
