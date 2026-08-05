"use client";
import { createTasksFromCSV } from "@/model/task";
import React, { useState, useRef } from "react";
import Papa from "papaparse";
import Select from "@/components/Select";
import toast from "react-hot-toast";

const TaskForm = ({ groups }) => {
  const ref = useRef(null);
  const [selectedFile, setSelectedFile] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [imageBaseUrl, setImageBaseUrl] = useState("");

  const handleOptionChange = async (event) => {
    setSelectedOption(event.target.value);
  };

  const handleFileChange = (event) => {
    //  Passing file data (event.target.files[0]) to parse using Papa.parse
    Papa.parse(event.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        console.log(results);
        setSelectedFile(results?.data);
      },
    });
  };

  const uploadTask = async (formData) => {
    if (selectedFile.length > 1000) {
      toast.error("Please select a file with less than 1000 rows");
      return;
    }
    const taskJson = JSON.stringify(selectedFile);
    formData.append("tasks", taskJson);
    formData.append("image_base_url", imageBaseUrl);
    const tasksCreated = await createTasksFromCSV(formData);
    // if tasksCreated is not empty, then toast success message
    // else toast error message
    if (tasksCreated?.count > 0) {
      toast.success("Tasks created successfully");
    } else {
      toast.error("Error creating tasks");
    }
  };

  return (
    <>
      <form
        ref={ref}
        className="flex flex-col md:flex-row justify-center items-center md:items-end pt-10 space-y-5 space-x-0 md:space-y-0 md:space-x-10"
      >
        <Select
          title="group_id"
          label="Group"
          options={groups}
          selectedOption={selectedOption}
          handleOptionChange={handleOptionChange}
        />
        <div className="form-control w-full max-w-xs">
          <label className="label" htmlFor="image_base_url">
            <span className="label-text text-base font-semibold">
              Image base URL (S3 folder):
            </span>
          </label>
          <input
            id="image_base_url"
            name="image_base_url"
            type="text"
            placeholder="https://bucket.s3.amazonaws.com/folder"
            className="input input-bordered input-accent max-w-xs"
            value={imageBaseUrl}
            onChange={(e) => setImageBaseUrl(e.target.value)}
          />
          <label className="label" htmlFor="image_base_url">
            <span className="label-text-alt text-gray-500">
              Leave blank if the CSV already has a full url/image_url column.
            </span>
          </label>
        </div>
        <div className="form-control w-full max-w-xs">
          <label className="label" htmlFor="file_name">
            <span className="label-text text-base font-semibold">
              Choose a file (CSV only):
            </span>
          </label>
          <input
            id="file_name"
            name="file_name"
            accept=".csv"
            type="file"
            required
            className="file-input file-input-bordered file-input-accent max-w-xs"
            onChange={handleFileChange}
          />
        </div>
        <button
          type="submit"
          className="btn btn-accent"
          formAction={async (formData) => {
            ref.current?.reset();
            uploadTask(formData);
          }}
        >
          Upload
        </button>
      </form>
    </>
  );
};

export default TaskForm;
