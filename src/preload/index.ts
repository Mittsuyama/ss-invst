import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  AGENT_EVENT_CHANNEL,
  AGENT_PROMPT_CHANNEL,
  AGENT_ABORT_CHANNEL,
  AGENT_RESET_CHANNEL,
  AGENT_PICK_FILES_CHANNEL,
  AGENT_LIST_SKILLS_CHANNEL,
  type AgentEvent,
  type AgentPromptPayload,
  type AgentAttachment,
  type SkillInfo,
} from '@shared/types/agent'
import {
  WORKSPACE_PICK_CHANNEL,
  SESSION_LIST_CHANNEL,
  SESSION_CREATE_CHANNEL,
  SESSION_LOAD_CHANNEL,
  SESSION_DELETE_CHANNEL,
  SESSION_CLEAR_CHANNEL,
  SESSION_LIST_FILES_CHANNEL,
  SESSION_OPEN_FILE_CHANNEL,
  SESSION_READ_FILE_CHANNEL,
  type SessionMeta,
  type SessionSnapshot,
  type SessionFileList,
  type SessionReadFileResult,
} from '@shared/types/session'

// Custom APIs for renderer
const agent = {
  prompt: (payload: AgentPromptPayload) => ipcRenderer.invoke(AGENT_PROMPT_CHANNEL, payload),
  abort: () => ipcRenderer.invoke(AGENT_ABORT_CHANNEL),
  reset: () => ipcRenderer.invoke(AGENT_RESET_CHANNEL),
  pickFiles: (): Promise<AgentAttachment[]> => ipcRenderer.invoke(AGENT_PICK_FILES_CHANNEL),
  listSkills: (): Promise<SkillInfo[]> => ipcRenderer.invoke(AGENT_LIST_SKILLS_CHANNEL),
  onEvent: (callback: (event: AgentEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AgentEvent) => callback(payload)
    ipcRenderer.on(AGENT_EVENT_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(AGENT_EVENT_CHANNEL, listener)
    }
  },
}

const session = {
  pickWorkspace: (): Promise<string | null> => ipcRenderer.invoke(WORKSPACE_PICK_CHANNEL),
  list: (workspacePath: string): Promise<SessionMeta[]> =>
    ipcRenderer.invoke(SESSION_LIST_CHANNEL, workspacePath),
  create: (workspacePath: string): Promise<SessionMeta> =>
    ipcRenderer.invoke(SESSION_CREATE_CHANNEL, workspacePath),
  load: (workspacePath: string, id: string): Promise<SessionSnapshot> =>
    ipcRenderer.invoke(SESSION_LOAD_CHANNEL, workspacePath, id),
  delete: (workspacePath: string, id: string): Promise<boolean> =>
    ipcRenderer.invoke(SESSION_DELETE_CHANNEL, workspacePath, id),
  clear: (workspacePath: string, id: string): Promise<SessionMeta> =>
    ipcRenderer.invoke(SESSION_CLEAR_CHANNEL, workspacePath, id),
  listFiles: (workspacePath: string, id: string): Promise<SessionFileList> =>
    ipcRenderer.invoke(SESSION_LIST_FILES_CHANNEL, workspacePath, id),
  openFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke(SESSION_OPEN_FILE_CHANNEL, filePath),
  readFile: (filePath: string): Promise<SessionReadFileResult> =>
    ipcRenderer.invoke(SESSION_READ_FILE_CHANNEL, filePath),
}

export type AgentBridge = typeof agent
export type SessionBridge = typeof session

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('agent', agent)
    contextBridge.exposeInMainWorld('session', session)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.agent = agent
  // @ts-ignore (define in dts)
  window.session = session
}
