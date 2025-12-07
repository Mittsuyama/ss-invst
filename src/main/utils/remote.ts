export const makeSureIsArray = <T = any>(data: any): Array<T> => {
  if (Array.isArray(data)) {
    return data;
  }
  return [];
};
