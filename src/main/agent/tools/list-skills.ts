import type { AgentTool } from '@earendil-works/pi-agent-core';
import { listSkills } from '../skill/skill-registry';
import { ok, type PiType } from './common';

export function createListSkillsTool(Type: PiType): AgentTool {
  return {
    name: 'list_skills',
    label: '列出技能',
    description:
      '列出可用的运行时 skill（名称 + 描述）。涉及专业分析流程（如价值投资、技术买卖点、因子研究）时，先调用它查看，再用 use_skill 选定。',
    parameters: Type.Object({}),
    execute: async () => {
      const skills = listSkills().map((s) => ({
        name: s.name,
        description: s.description,
        params: s.params ?? [],
      }));
      return ok({ count: skills.length }, skills);
    },
  };
}
