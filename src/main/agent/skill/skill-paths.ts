import { app } from 'electron';
import path from 'node:path';
import { is } from '@electron-toolkit/utils';

/**
 * 内置 skill 根目录。
 * - dev：仓库根 resources/skills（app.getAppPath() 指向项目根）
 * - prod：process.resourcesPath/skills（extraResources 复制到这里，asar 之外）
 */
export function skillRootDir(): string {
  if (is.dev) {
    return path.join(app.getAppPath(), 'resources', 'skills');
  }
  return path.join(process.resourcesPath, 'skills');
}
