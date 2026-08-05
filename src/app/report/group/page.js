import React from "react";
import { getAllGroup } from "@/model/group";
import GroupReport from "./GroupReport";
export const dynamic = "force-dynamic";

const Group = async () => {
  const groups = await getAllGroup();

  return (
    <>
      <GroupReport groups={groups} />
    </>
  );
};

export default Group;
