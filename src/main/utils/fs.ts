import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';

export const assureDirExit = (...paths: string[]) => {
  const dir = path.join(...paths);
  try {
    if (!fs.statSync(dir).isDirectory) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const checkFileExist = (...paths: string[]) => {
  const pathname = path.join(...paths);
  return fs.existsSync(pathname);
};

export const getFileText = async (...paths: string[]) => {
  const filepath = path.join(...paths);
  return new Promise<string>((res, rej) => {
    fs.readFile(filepath, 'utf-8', (error, data) => {
      if (error) {
        return rej(error);
      }
      res(data);
    });
  });
};

export const getFileTextListUnderDirectory = async (...paths: string[]) => {
  const dir = path.join(...paths);
  assureDirExit(dir);
  const filenameList = fs.readdirSync(dir);
  return await Promise.all(
    filenameList.map(
      (name) =>
        new Promise<string>((res, rej) => {
          fs.readFile(path.join(dir, name), 'utf-8', (error, data) => {
            if (error) {
              return rej(error);
            }
            res(data);
          });
        }),
    ),
  );
};

export const writeBatchFileTextUnderDirectory = async (
  dir: string,
  files: Array<{ name: string; text: string }>,
) => {
  assureDirExit(dir);
  return await Promise.all(
    files.map(
      ({ name, text }) =>
        new Promise<void>((res, rej) => {
          fs.writeFile(path.join(dir, name), text, 'utf-8', (error) => {
            if (error) {
              return rej(error);
            }
            res();
          });
        }),
    ),
  );
};

export const writeFileText = async (dir: string, filename: string, text: string) => {
  assureDirExit(dir);
  const data = fs.writeFileSync(path.join(dir, filename), text, 'utf-8');
  return data;
};

export const getFileBySystemSelector = async () => {
  const res = await dialog.showOpenDialog({ properties: ['openFile'] });
  return res.filePaths[0];
};

export const getDirectoryBySystemSelector = async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return res.filePaths[0];
};
