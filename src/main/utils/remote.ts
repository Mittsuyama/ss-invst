export const makeSureIsArray = <T = unknown>(data: unknown): Array<T> => {
  if (Array.isArray(data)) {
    return data as T[];
  }
  return [];
};
