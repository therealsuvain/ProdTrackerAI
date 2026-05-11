import { Task } from "@/types/task";
import { useReducer, useEffect } from "react";
import { randomUUID } from "expo-crypto";
import { cancelReminder, scheduleReminderTasks } from "./use-notifications";
import { generateEmbedding } from '@/utils/embedding-engine'
import { tagsDiff } from "@/utils/common-utils";

type FormState = Omit<Task, "id" | "notificationId" | "completed"> & {
  errors: Partial<
    Record<keyof Omit<Task, "id" | "notificationId" | "completed">, string>
  >;
};

type FormAction =
  | { type: "UPDATE_FIELD"; payload: { field: keyof FormState; value: any } }
  | { type: "SET_ERROR"; payload: { field: keyof FormState; message: string } }
  | { type: "CLEAR_ERRORS" }
  | { type: "RESET"; payload?: Partial<FormState> };

const initialState: FormState = {
  title: "",
  description: "",
  category: undefined,
  dueDate: new Date().toISOString(),
  reminder: false,
  reminderDate: undefined,
  priority: "medium",
  tags: undefined,
  errors: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "UPDATE_FIELD":
      return {
        ...state,
        [action.payload.field]: action.payload.value,
        errors: { ...state.errors, [action.payload.field]: undefined },
      };
    case "SET_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };
    case "CLEAR_ERRORS":
      return { ...state, errors: {} };
    case "RESET":
      return { ...initialState, ...action.payload };
    default:
      return state;
  }
};

interface UseTaskFormProps {
  addTask: (task: Task, tagIds: string[]) => Promise<void>;
  editTask: (task: Task, tagIds: string[]) => Promise<void>;
  addTags: (tags: string[]) => Promise<string[]>;
  editingTask: Task | null;
  onClose: () => void;
}

export const useTaskForm = ({
  addTask,
  editTask,
  addTags,
  editingTask,
  onClose,
}: UseTaskFormProps) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  useEffect(() => {
    if (editingTask) {
      //console.log("THIS ONE TasksS")
      dispatch({
        type: "RESET",
        payload: {
          title: editingTask.title,
          description: editingTask.description,
          category: editingTask.category,
          dueDate: editingTask.dueDate,
          reminder: editingTask.reminder,
          reminderDate: editingTask.reminderDate,
          priority: editingTask.priority,
          tags: editingTask.tags,
          createdAt: editingTask.createdAt,
          updatedAt: editingTask.updatedAt,
          embedding: editingTask.embedding,
        },
      });
    } else {
      //console.log("THIS TWO TASKS")
      dispatch({ type: "RESET" });
    }
  }, [editingTask]);

  const updateField = (field: keyof FormState, value: any) => {
    dispatch({ type: "UPDATE_FIELD", payload: { field, value } });
  };

  const onSubmit = async (tagIds: string[]) => {
    dispatch({ type: "CLEAR_ERRORS" });
    let hasError = false;
    if (!state.title) {
      dispatch({
        type: "SET_ERROR",
        payload: { field: "title", message: "Title is required" },
      });
      hasError = true;
      return;
    }

    if (state.reminder && !state.reminderDate) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "reminderDate",
          message: "For reminders, time is required",
        },
      });
      hasError = true;
      return;
    }

    if (hasError) return;
    let newTask: Task = {
      id: editingTask ? editingTask.id : randomUUID(),
      title: state.title,
      description: state.description,
      category: state.category,
      dueDate: state.dueDate,
      reminder: state.reminder,
      reminderDate: state.reminderDate,
      notificationId: editingTask ? editingTask.notificationId : undefined,
      priority: state.priority as Task["priority"],
      completed: editingTask ? editingTask.completed : false,
      tags: state.tags,
      createdAt: editingTask ? editingTask.createdAt : state.createdAt,
      updatedAt: state.updatedAt,
      embedding: state.embedding || await generateEmbedding(state.title, false)
    };

    if (editingTask && editingTask.reminder) {
      console.log("TASK FORM NOtif: cancelled old:1 new:0")
      if (editingTask.notificationId)
        await cancelReminder(editingTask.notificationId)
    }
    /* 
        if(editingTask && editingTask.reminderDate && newTask.reminderDate 
          && new Date(editingTask.reminderDate).toTimeString()!== new Date(newTask.reminderDate).toTimeString()){
          console.log("TASK FORM NOtif: cancelled old:1 new:1")
        if(editingTask.notificationId)
          await cancelReminder(editingTask.notificationId)
        } */

    if (newTask.reminder) {
      console.log("TASK FORM NOtif: scheduled")
      const notifId = await scheduleReminderTasks(newTask);
      newTask.notificationId = notifId;
    }

    if (tagIds.length > 0) {
      newTask.tags = tagIds
    }
    //console.log("TAGS of TASK", newTask.tags, state.tags);
    if (editingTask) {
      /*       const {newTagsDiff, commonTags} = tagsDiff(newTask.tags, editingTask.tags);
            if (newTagsDiff.length) {
              await addTags(newTagsDiff);
            } */
      //console.log("EDIT", {...newTask, embedding:[]});
      await editTask(newTask, tagIds);
      //setTasks(tasks.map((t) => (t.id === editingTask.id ? newTask : t)));
    } else {
      //console.log("NEW" ,{...newTask, embedding:[]});
      /*  if (newTask.tags) {
         await addTags(newTask.tags);
       } */
      await addTask(newTask, tagIds);
      //setTasks([...tasks, newTask]);
    }

    onClose();
    dispatch({ type: "RESET" });
  };

  return { state, updateField, onSubmit, dispatch };
};

