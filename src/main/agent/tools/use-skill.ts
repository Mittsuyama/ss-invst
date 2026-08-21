import type { AgentTool } from '@earendil-works/pi-agent-core';
import { ok, type PiType } from './common';

export function createUseSkillTool(
  Type: PiType,
  applySkill: (name: string) => string | undefined,
): AgentTool {
  return {
    name: 'use_skill',
    label: '选定技能',
    description:
      '选定一个 skill 作为当前技能，加载其流程说明（SKILL.md）。name 来自 list_skills。选定后按其步骤执行。',
    parameters: Type.Object({
      name: Type.String({ description: 'skill 名，来自 list_skills' }),
    }),
    execute: async (_id, params) => {
      const { name } = params as { name: string };
      const markdown = applySkill(name);
      if (markdown == null) {
        throw new Error(`未找到 skill：${name}，请先用 list_skills 查看可用 skill`);
      }
      return ok({ skill: name }, markdown);
    },
  };
}
