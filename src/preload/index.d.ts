import { ElectronAPI } from '@electron-toolkit/preload'
import type { AgentEvent, AgentPromptPayload, AgentAttachment, SkillInfo } from '@shared/types/agent'
import type { SessionMeta, SessionSnapshot, SessionFileList, SessionReadFileResult } from '@shared/types/session'

declare global {
  interface Window {
    electron: ElectronAPI
    agent: {
      prompt: (payload: AgentPromptPayload) => Promise<unknown>
      abort: () => Promise<unknown>
      reset: () => Promise<unknown>
      pickFiles: () => Promise<AgentAttachment[]>
      listSkills: () => Promise<SkillInfo[]>
      onEvent: (callback: (event: AgentEvent) => void) => () => void
    }
    session: {
      pickWorkspace: () => Promise<string | null>
      list: (workspacePath: string) => Promise<SessionMeta[]>
      create: (workspacePath: string) => Promise<SessionMeta>
      load: (workspacePath: string, id: string) => Promise<SessionSnapshot>
      delete: (workspacePath: string, id: string) => Promise<boolean>
      clear: (workspacePath: string, id: string) => Promise<SessionMeta>
      listFiles: (workspacePath: string, id: string) => Promise<SessionFileList>
      openFile: (filePath: string) => Promise<boolean>
      readFile: (filePath: string) => Promise<SessionReadFileResult>
    }
    api: unknown
  }
}
