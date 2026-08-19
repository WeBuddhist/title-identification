"use client";

import {
  getTasksOrAssignMore,
  prefetchNextTaskBatch,
  updateTask,
} from "@/model/action";
import React, { useState, useRef, useEffect, useCallback } from "react";

import { UserProgressStats } from "@/model/task";
import Sidebar from "@/components/Sidebar";
import DisplayImage from "@/components/DisplayImage";
import toast from "react-hot-toast";
import AppContext from "./AppContext";

const PREFETCH_THRESHOLD = 3;

const TaskView = ({ tasks, userDetail, language, userHistory }) => {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const lang = language[languageSelected];
  const [taskList, setTaskList] = useState(tasks);
  const [userTaskStats, setUserTaskStats] = useState({
    completedTaskCount: 0,
    totalTaskCount: 0,
    totalTaskPassed: 0,
  }); // {completedTaskCount, totalTaskCount, totalTaskPassed}
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTitlePage, setIsTitlePage] = useState(null);
  const [isSectionTitle, setIsSectionTitle] = useState(null);
  const [diplomaticText, setDiplomaticText] = useState("");
  const [normalisedText, setNormalisedText] = useState("");
  const { id: userId, group_id: groupId, role } = userDetail;
  const currentTimeRef = useRef(null);
  const prefetchPromiseRef = useRef(null);
  const isPrefetchingRef = useRef(false);

  // The pair of texts each role starts from: the transcriber works from
  // Rachael's script output, reviewers work from the previous stage's answer.
  const getSourceValues = () => {
    if (!taskList?.length) return { diplomatic: "", normalised: "" };
    const currentTask = taskList[0];
    switch (role) {
      case "TRANSCRIBER":
        return {
          diplomatic: currentTask?.diplomatic_context || "",
          normalised: currentTask?.normalised_context || "",
        };
      case "REVIEWER":
        return {
          diplomatic: currentTask?.corrected_diplomatic || "",
          normalised: currentTask?.corrected_normalised || "",
        };
      case "FINAL_REVIEWER":
        return {
          diplomatic: currentTask?.reviewed_diplomatic || "",
          normalised: currentTask?.reviewed_normalised || "",
        };
      default:
        return { diplomatic: "", normalised: "" };
    }
  };

  const getUserProgress = useCallback(async () => {
    const { completedTaskCount, totalTaskCount, totalTaskPassed } =
      await UserProgressStats(userId, role, groupId);
    setUserTaskStats({
      completedTaskCount,
      totalTaskCount,
      totalTaskPassed,
    });
  }, [userId, role, groupId]);

  const ensurePrefetch = useCallback(() => {
    if (isPrefetchingRef.current || prefetchPromiseRef.current) {
      return prefetchPromiseRef.current;
    }
    isPrefetchingRef.current = true;
    prefetchPromiseRef.current = prefetchNextTaskBatch(groupId, userId, role)
      .catch((error) => {
        console.error("Failed to prefetch next task batch:", error);
        return [];
      })
      .finally(() => {
        isPrefetchingRef.current = false;
      });
    return prefetchPromiseRef.current;
  }, [groupId, userId, role]);

  // Initial stats fetch; afterwards the completed count is bumped optimistically
  // on submit and re-synced from the server once per batch load.
  useEffect(() => {
    getUserProgress();
  }, [getUserProgress]);

  useEffect(() => {
    // Assign a value to currentTimeRef.current
    currentTimeRef.current = new Date().toISOString();
    if (taskList?.length) {
      setIsLoading(false);
      const { diplomatic, normalised } = getSourceValues();
      setIsTitlePage(null); // Reset to null, will be set by user interaction
      setIsSectionTitle(null);
      setDiplomaticText(diplomatic);
      setNormalisedText(normalised);

      // Prefetch next batch before the queue empties so the last submit stays snappy
      if (taskList.length <= PREFETCH_THRESHOLD && !prefetchPromiseRef.current) {
        ensurePrefetch();
      }
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskList, role, ensurePrefetch]);

  const handleYes = () => {
    if (isSubmitting) return;
    setIsTitlePage(true);
    // The section question only applies to non-title pages
    setIsSectionTitle(null);
  };

  const handleNo = () => {
    if (isSubmitting) return;
    setIsTitlePage(false);
  };

  const handleSectionYes = () => {
    if (isSubmitting) return;
    setIsSectionTitle(true);
  };

  const handleSectionNo = () => {
    if (isSubmitting) return;
    setIsSectionTitle(false);
  };

  const validateSubmission = () => {
    // User must select either YES or NO
    if (isTitlePage === null) {
      return {
        isValid: false,
        message:
          lang.validation_select_option ||
          "Please select YES or NO before submitting.",
      };
    }

    // A NO to "title page?" raises the follow-up section-title question,
    // which must also be answered
    if (isTitlePage === false && isSectionTitle === null) {
      return {
        isValid: false,
        message:
          lang.validation_select_section_option ||
          "Please answer 'Is this a section title?' before submitting.",
      };
    }

    return { isValid: true, message: "" };
  };

  const applyRoleBusinessLogic = (action, currentTask) => {
    const updatedTask = { ...currentTask };

    if (action !== "submit" && action !== "reject" && action !== "trash") {
      return updatedTask;
    }

    // The section-title answer only exists for non-title pages; null means
    // the question was never asked (title page = YES)
    const sectionAnswer = isTitlePage === false ? isSectionTitle : null;

    switch (role) {
      case "TRANSCRIBER":
        updatedTask.is_title_page = isTitlePage;
        updatedTask.is_section_title = sectionAnswer;
        updatedTask.corrected_diplomatic = diplomaticText;
        updatedTask.corrected_normalised = normalisedText;
        break;
      case "REVIEWER":
        updatedTask.reviewed_is_title = isTitlePage;
        updatedTask.reviewed_is_section_title = sectionAnswer;
        updatedTask.reviewed_diplomatic = diplomaticText;
        updatedTask.reviewed_normalised = normalisedText;
        break;
      case "FINAL_REVIEWER":
        updatedTask.final_is_title = isTitlePage;
        updatedTask.final_is_section_title = sectionAnswer;
        updatedTask.final_diplomatic = diplomaticText;
        updatedTask.final_normalised = normalisedText;
        break;
      default:
        break;
    }

    return updatedTask;
  };

  const loadNextBatch = async () => {
    setIsLoading(true);
    try {
      let moreTasks = [];
      if (prefetchPromiseRef.current) {
        moreTasks = await prefetchPromiseRef.current;
        prefetchPromiseRef.current = null;
      }
      if (!moreTasks?.length) {
        moreTasks = await getTasksOrAssignMore(groupId, userId, role);
      }
      setTaskList(moreTasks || []);
      // Re-sync the optimistic progress counters once per batch
      getUserProgress();
    } catch (error) {
      console.error("Failed to load next task batch:", error);
      toast.error("Failed to load next tasks. Please refresh.");
      setTaskList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskAndIndex = async (action) => {
    if (isSubmitting) {
      return;
    }

    // Validate before submission
    if (action === "submit") {
      const validation = validateSubmission();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
    }

    if (!taskList?.length) {
      return;
    }

    const currentTask = taskList[0];
    const { id } = currentTask;
    const remainingTasks = taskList.slice(1);
    const updatedTask = applyRoleBusinessLogic(action, currentTask);
    const submitTime = currentTimeRef.current;
    const isLastTask = remainingTasks.length === 0;

    setIsSubmitting(true);

    let rolledBack = false;
    let nextBatchEarly = null;

    const rollbackTask = () => {
      rolledBack = true;
      setTaskList((prev) =>
        prev.some((task) => task.id === currentTask.id)
          ? prev
          : [currentTask, ...prev]
      );
      setIsLoading(false);
    };

    // Optimistic UI: advance to the next task immediately; persist in background
    if (!isLastTask) {
      setTaskList(remainingTasks);
      if (action === "submit") {
        currentTimeRef.current = new Date().toISOString();
      }
    } else {
      // Last task in queue — swap in the prefetched batch as soon as it is
      // ready instead of holding the loading screen on the submit round trip
      setIsLoading(true);
      if (prefetchPromiseRef.current) {
        nextBatchEarly = prefetchPromiseRef.current;
        prefetchPromiseRef.current = null;
        nextBatchEarly.then((moreTasks) => {
          // If the submit failed and rolled back, drop this batch: appending it
          // would duplicate tasks that loadNextBatch re-fetches on retry. The
          // rows stay assigned to this user in the DB and resurface next load.
          if (rolledBack || !moreTasks?.length) return;
          setTaskList(moreTasks);
          getUserProgress();
        });
      }
    }

    try {
      const { msg, error } = await updateTask(
        action,
        id,
        "", // transcript not used anymore
        updatedTask,
        role,
        submitTime
      );

      if (error || msg?.error) {
        // Roll back optimistic removal so the user can retry
        rollbackTask();
        toast.error(error || msg.error);
        return;
      }

      toast.success(msg.success);

      if (action === "submit") {
        // Optimistic counter; re-synced from the server on each batch load.
        // A FINAL_REVIEWER submit finalises the task, which also counts as passed.
        setUserTaskStats((prev) => ({
          ...prev,
          completedTaskCount: prev.completedTaskCount + 1,
          totalTaskPassed:
            role === "FINAL_REVIEWER"
              ? prev.totalTaskPassed + 1
              : prev.totalTaskPassed,
        }));
      }

      if (isLastTask) {
        const earlyBatch = nextBatchEarly ? await nextBatchEarly : null;
        if (!earlyBatch?.length) {
          await loadNextBatch();
        }
      }
    } catch (error) {
      rollbackTask();
      toast.error("Failed to update task. Please try again.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Corrections to both transcriptions are wanted whether or not the page is
  // a title page, so the text boxes are always editable
  const canEdit = !isSubmitting;

  // Auto-growing one-line text boxes (client request: fit one line so the
  // page needs less scrolling on a laptop). An invisible replica of the text
  // shares the textarea's grid cell; it sets the row height to the wrapped
  // text height, so the box is one line tall for typical titles but still
  // grows to show longer text instead of hiding it behind an inner scrollbar.
  const textBoxSharedClasses =
    "col-start-1 row-start-1 w-full p-2 border rounded-md text-4xl whitespace-pre-wrap break-words";

  const renderAutoGrowTextarea = (value, onChange) => (
    <div className="grid w-full">
      <div
        aria-hidden="true"
        className={`${textBoxSharedClasses} invisible border-transparent`}
      >
        {value + " "}
      </div>
      <textarea
        value={value}
        onChange={onChange}
        readOnly={!canEdit}
        disabled={isSubmitting}
        className={`${textBoxSharedClasses} resize-none overflow-hidden ${
          canEdit
            ? "bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            : "bg-gray-50 text-gray-800"
        } disabled:opacity-60`}
        rows={1}
      />
    </div>
  );

  return (
    <AppContext.Provider
      value={{ languageSelected, setLanguageSelected, lang }}
    >
      <Sidebar
        userDetail={userDetail}
        userTaskStats={userTaskStats}
        taskList={taskList}
        role={role}
        setTaskList={setTaskList}
        userHistory={userHistory}
        updateTaskAndIndex={updateTaskAndIndex}
        isSubmitting={isSubmitting}
      >
        {/* Page content here */}
        {/* justify-start, not center: breaks position:sticky on the image
            band below once content overflows and the page scrolls. */}
        <div className="w-full flex flex-col justify-start items-center">
          {isLoading ? (
            <h1 className="font-bold text-md md:text-3xl">loading...</h1>
          ) : taskList?.length ? (
            <>
              {/* Sticky so the page image stays visible while the user scrolls
                  down to edit the transcription fields below it — images vary
                  in size batch to batch, and a tall one would otherwise be
                  scrolled out of view the moment editing starts. */}
              <div className="sticky top-0 z-10 w-full flex flex-col items-center bg-white pt-3 pb-2">
                {(role === "REVIEWER" || role === "FINAL_REVIEWER") && (
                  <div className="flex gap-4 mt-2 text-sm text-black">
                    <p>
                      <strong>{lang.transcriber} : </strong>
                      <span>
                        {taskList[0]?.transcriber
                          ? taskList[0].transcriber?.name
                          : taskList[0]["transcriber.name"]}
                      </span>
                    </p>
                    {role === "FINAL_REVIEWER" && (
                      <p>
                        <strong>{lang.reviewer} : </strong>
                        <span>
                          {taskList[0]?.reviewer
                            ? taskList[0]?.reviewer?.name
                            : taskList[0]["reviewer.name"]}
                        </span>
                      </p>
                    )}
                  </div>
                )}
                <DisplayImage task={taskList[0]} />
              </div>
              <div className="w-[90%] my-3 md:my-4">
                <div className="flex flex-col border rounded-md shadow-sm shadow-gray-400 items-center p-4">
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <label className="text-red-500 font-bold">
                        {lang.diplomatic_transcription}
                      </label>
                      {renderAutoGrowTextarea(diplomaticText, (e) =>
                        setDiplomaticText(e.target.value)
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-green-500 font-bold">
                        {lang.normalised_transcription}
                      </label>
                      {renderAutoGrowTextarea(normalisedText, (e) =>
                        setNormalisedText(e.target.value)
                      )}
                    </div>

                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-4">
                        {lang.is_title_page_question}
                      </h3>
                      <div className="flex justify-center gap-4 mb-4">
                        <button
                          onClick={handleYes}
                          disabled={isSubmitting}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isTitlePage === true
                              ? "bg-green-500 text-white shadow-lg transform scale-105"
                              : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                          } disabled:opacity-60`}
                        >
                          {lang.yes}
                        </button>
                        <button
                          onClick={handleNo}
                          disabled={isSubmitting}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isTitlePage === false
                              ? "bg-red-500 text-white shadow-lg transform scale-105"
                              : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                          } disabled:opacity-60`}
                        >
                          {lang.no}
                        </button>
                      </div>
                      {isTitlePage === false && (
                        <>
                          <h3 className="text-xl font-bold mb-4">
                            {lang.is_section_title_question}
                          </h3>
                          <div className="flex justify-center gap-4 mb-4">
                            <button
                              onClick={handleSectionYes}
                              disabled={isSubmitting}
                              className={`px-8 py-3 rounded-md font-medium ${
                                isSectionTitle === true
                                  ? "bg-green-500 text-white shadow-lg transform scale-105"
                                  : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                              } disabled:opacity-60`}
                            >
                              {lang.yes}
                            </button>
                            <button
                              onClick={handleSectionNo}
                              disabled={isSubmitting}
                              className={`px-8 py-3 rounded-md font-medium ${
                                isSectionTitle === false
                                  ? "bg-red-500 text-white shadow-lg transform scale-105"
                                  : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                              } disabled:opacity-60`}
                            >
                              {lang.no}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-center items-center mt-10 p-5">
              <h1 className="font-bold text-lg md:text-3xl">
                No task found, will allocate soon
              </h1>
            </div>
          )}
        </div>
      </Sidebar>
    </AppContext.Provider>
  );
};

export default TaskView;
