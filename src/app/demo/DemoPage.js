"use client";

import React, { useEffect, useRef, useState } from "react";
import AppContext from "@/components/AppContext";
import DemoSidebar from "./DemoSidebar";
import ActionButtons from "@/components/ActionButtons";
import DisplayImage from "@/components/DisplayImage";
import { changeTaskState } from "@/model/action";

const DemoPage = ({ userDetail, language, tasks, userHistory }) => {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const lang = language[languageSelected];
  const [taskList, setTaskList] = useState(tasks);
  const [historyList, setHistoryList] = useState(userHistory); // {completedTaskCount, totalTaskCount, totalTaskPassed}
  const [diplomaticText, setDiplomaticText] = useState("");
  const [normalisedText, setNormalisedText] = useState("");
  const [isTitlePage, setIsTitlePage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { role } = userDetail;

  useEffect(() => {
    if (taskList?.length) {
      setIsLoading(false);
      const currentTask = taskList[0];
      // Practice mode always starts a task from Rachael's raw script output
      setDiplomaticText(currentTask?.diplomatic_context || "");
      setNormalisedText(currentTask?.normalised_context || "");
      setIsTitlePage(null);
    } else {
      setIsLoading(false);
    }
  }, [taskList, role]);

  const handleYes = () => setIsTitlePage(true);
  const handleNo = () => {
    setIsTitlePage(false);
    const currentTask = taskList[0];
    setDiplomaticText(currentTask?.diplomatic_context || "");
    setNormalisedText(currentTask?.normalised_context || "");
  };

  const updateTaskAndIndex = async (action) => {
    try {
      if (!taskList?.length) return;

      const task = taskList[0];
      const { id } = task;
      const updatedTask = {
        ...task,
        is_title_page: isTitlePage,
        corrected_diplomatic: diplomaticText,
        corrected_normalised: normalisedText,
      };

      const changeState = await changeTaskState(updatedTask, role, action);
      // remove the task from the tasklist and add to history
      // Practice mode only — nothing here is persisted to the database.
      setTaskList((prev) => prev.filter((task) => task.id !== id));
      setHistoryList((prev) => [
        {
          ...updatedTask,
          state: changeState.state,
          submitted_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error) {
      throw new Error(error);
    }
  };

  const canEdit = isTitlePage === true;

  return (
    <>
      <AppContext.Provider
        value={{ languageSelected, setLanguageSelected, lang }}
      >
        <DemoSidebar
          userDetail={userDetail}
          taskList={taskList}
          role={role}
          setTaskList={setTaskList}
          userHistory={historyList}
          setHistoryList={setHistoryList}
        >
          {/* Page content here */}
          {/* justify-start, not center: breaks position:sticky on the image
              band below once content overflows and the page scrolls. */}
          <div className="h-full w-full flex flex-col justify-start items-center">
            {isLoading ? (
              <h1 className="font-bold text-md md:text-3xl">loading...</h1>
            ) : taskList?.length ? (
              <>
                <div className="sticky top-0 z-10 w-full flex flex-col items-center bg-white pt-3 pb-2">
                  <DisplayImage task={taskList[0]} />
                </div>
                <div className="w-[90%] my-5 md:my-10">
                  <div className="flex flex-col gap-10 border rounded-md shadow-sm shadow-gray-400 items-center p-4">
                    <div className="w-full space-y-4">
                      <div className="space-y-2">
                        <label className="text-red-500 font-bold">
                          {lang.diplomatic_transcription}
                        </label>
                        <textarea
                          value={diplomaticText}
                          onChange={(e) => setDiplomaticText(e.target.value)}
                          readOnly={!canEdit}
                          className={`w-full p-2 border rounded-md resize-none text-4xl ${
                            canEdit
                              ? "bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                              : "bg-gray-50 text-gray-800"
                          }`}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-green-500 font-bold">
                          {lang.normalised_transcription}
                        </label>
                        <textarea
                          value={normalisedText}
                          onChange={(e) => setNormalisedText(e.target.value)}
                          readOnly={!canEdit}
                          className={`w-full p-2 border rounded-md resize-none text-4xl ${
                            canEdit
                              ? "bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                              : "bg-gray-50 text-gray-800"
                          }`}
                          rows={3}
                        />
                      </div>

                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-4">
                          {lang.is_title_page_question}
                        </h3>
                        <div className="flex justify-center gap-4 mb-4">
                          <button
                            onClick={handleYes}
                            className={`px-8 py-3 rounded-md font-medium ${
                              isTitlePage === true
                                ? "bg-green-500 text-white shadow-lg transform scale-105"
                                : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                            }`}
                          >
                            {lang.yes}
                          </button>
                          <button
                            onClick={handleNo}
                            className={`px-8 py-3 rounded-md font-medium ${
                              isTitlePage === false
                                ? "bg-red-500 text-white shadow-lg transform scale-105"
                                : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                            }`}
                          >
                            {lang.no}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <ActionButtons
                  updateTaskAndIndex={updateTaskAndIndex}
                  tasks={taskList}
                  role={role}
                />
              </>
            ) : (
              <div className="flex flex-col justify-center items-center mt-10 p-5">
                <h1 className="font-bold text-lg md:text-3xl">
                  No task found, will allocate soon
                </h1>
              </div>
            )}
          </div>
        </DemoSidebar>
      </AppContext.Provider>
    </>
  );
};

export default DemoPage;
