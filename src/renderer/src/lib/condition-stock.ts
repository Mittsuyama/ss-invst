export const buildConditionStockQuery = (idList: string[], fields: string[]) => {
  return [idList.map((item) => item.split('.')[1]).join(';'), ...fields].join(';');
};
