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

  return (
    // justify-start (not center): the task page is usually taller than the
    // screen and must start at the top. No overflow-y-auto here: without a
    // bounded height it never scrolls itself; the document/<html> does.
    <div className="flex flex-col justify-start items-center">
      {session === undefined || session === "" ? (
        <>
          <div className="text-xl font-semibold mt-10 p-5 text-center">
            No user found ,URL must end with ?session=EMAIL
          </div>
          <Link href="/dashboard" type="button" className="btn btn-accent">
            Dashboard
          </Link>
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
