const defaultUserIds = process.env.INITIAL_USER_IDS?.split(/\s*,\s*/);

export const useUserStore = (initialUserIds: string[] | undefined = defaultUserIds) => {
	const userIds = new Set(initialUserIds);

	const add = (userId: string) => {
		if (userIds.has(userId)) {
			return false;
		}

		userIds.add(userId);
		return true;
	};

	const remove = (userId: string) => userIds.delete(userId);

	const clear = () => {
		const count = userIds.size;
		userIds.clear();

		return count;
	};

	const list = () => Array.from(userIds);

	const count = () => userIds.size;

	const has = (userId: string) => userIds.has(userId);

	return { add, remove, clear, list, count, has };
};

export const userStore = useUserStore();

