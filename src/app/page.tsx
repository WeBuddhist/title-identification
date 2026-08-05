import Link from "next/link";
import { getUserTask } from "../model/action";
import languagesObject from "../../data/language";
import TaskView from "@/components/TaskView";

export default async function Home({ searchParams }: { searchParams: any }) {
  const language = languagesObject;
  const { session } = searchParams;
  let userTasks;
  let userDetail;
  let errMsg;
  let userHistory;
  if (session && session !== "") {
    const result = await getUserTask(session);
    if (result?.error) {
      errMsg = result?.error;
    } else {
      userTasks = result?.userTasks;
      userDetail = result?.userData;
      userHistory = result?.userHistory;
    }
  }

  const routes = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Report", path: "/report" },
    { name: "Stats", path: "/stats" },
  ];

  return (
    // justify-start (not center): position: sticky inside a centered flex
    // column doesn't reliably stick once content overflows and scrolls.
    // No overflow-y-auto here: without a bounded height it never actually
    // scrolls itself (the document/<html> does), which makes it the sticky
    // "scroll container" by CSS spec while it never fires a scroll event —
    // any position:sticky descendant (the task image band) goes inert.
    <div className="flex flex-col justify-start items-center">
      {session === undefined || session === "" ? (
        <>
          <div className="text-xl font-semibold mt-10 p-5 text-center">
            No user found ,URL must end with ?session=EMAIL
          </div>
          <div className="flex flex-col gap-6 sm:flex-row">
            {routes.map((route) => (
              <Link
                key={route.name}
                href={route.path}
                type="button"
                className="btn btn-accent"
              >
                {route.name}
              </Link>
            ))}
          </div>
        </>
      ) : errMsg ? (
        <div className="mt-10 p-5 text-xl font-semibold text-center">
          {errMsg}
        </div>
      ) : (
        <TaskView
          tasks={userTasks}
          userDetail={userDetail}
          language={language}
          userHistory={userHistory}
        />
      )}
    </div>
  );
}
