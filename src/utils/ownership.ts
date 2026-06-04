export const ownsRecord = (record: any, user: any) => {
  return record?.user === user?._id || record?.userId === user?.firebaseId;
};

export const ensureArray = <T>(value: T[] | undefined | null): T[] => {
  return Array.isArray(value) ? value : [];
};
