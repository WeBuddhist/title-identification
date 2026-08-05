import React from "react";
import { getAllUser } from "@/model/user";
import UserReport from "./UserReport";
export const dynamic = "force-dynamic";

const User = async ({ searchParams, params }) => {
  const { id } = params;
  const users = await getAllUser();

  return (
    <>
      <UserReport id={id} users={users} searchParams={searchParams} />
    </>
  );
};

export default User;
