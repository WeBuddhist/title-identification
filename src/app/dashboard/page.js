import React from "react";
import Link from "next/link";

const Dashboard = async ({ searchParams }) => {
  const session = searchParams?.session ?? "";

  const routes = [
    { label: "group", href: "/dashboard/group" },
    { label: "user", href: "/dashboard/user" },
    {
      label: "download",
      href: session
        ? `/download?session=${encodeURIComponent(session)}`
        : "/download",
    },
    { label: "report", href: "/report" },
    { label: "stats", href: "/stats" },
  ];

  return (
    <div className="min-h-screen flex justify-center items-center p-5">
      <div className="grid w-full max-w-5xl grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        {routes.map((route) => (
          <Link
            key={route.label}
            href={route.href}
            className="btn btn-accent text-base text-center w-1/2 mx-auto sm:text-xl sm:w-full"
            type="button"
          >
            {route.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
