import { contextBridge } from "electron";

// Bridge between main process and renderer. Stage 1: empty.
// Future stages will expose ipcRenderer-backed APIs here via contextBridge.
contextBridge.exposeInMainWorld("api", {});
