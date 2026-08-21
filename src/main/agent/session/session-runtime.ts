/**
 * 当前会话的运行时状态（供工具 save_file / run_script / read_file 等读取）。
 * 与 agent.ts 里的会话状态保持同步。
 */
export const sessionRuntime = {
  workspacePath: '',
  sessionId: '',
  /** 当前选定的 skill 名（空 = 未选定） */
  currentSkill: '',
};
