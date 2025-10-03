interface RedemptionRecord {
	code: string;
	userId: string;
	timestamp: Date;
	success: boolean;
	error?: string;
}

const useAnalytics = () => {
	const records: RedemptionRecord[] = [];

	const addRecord = (code: string, userId: string, success: boolean, error?: string) => records.push({
		code,
		userId,
		timestamp: new Date(),
		success,
		error
	});

	const getStats = () => {
		const total = records.length;
		const successful = records.filter(({ success }) => success).length;
		const failed = total - successful;

		let successRate = '0';
		if (total > 0) {
			successRate = (successful / total * 100).toFixed(1);
		}

		const uniqueCodes = new Set(records.map(({ code }) => code)).size;
		const uniqueUsers = new Set(records.map(({ userId }) => userId)).size;

		return {
			total,
			successful,
			failed,
			successRate,
			uniqueCodes,
			uniqueUsers
		};
	};

	const getRecentRedemptions = (limit = 10) => records
		.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
		.slice(0, limit);

	const getUserStats = (userId: string) => {
		const userRecords = records.filter(r => r.userId === userId);
		const successful = userRecords.filter(({ success }) => success).length;
		let successRate = '0';
		if (userRecords.length > 0) {
			successRate = (successful / userRecords.length * 100).toFixed(1);
		}

		return {
			total: userRecords.length,
			successful,
			failed: userRecords.length - successful,
			successRate
		};
	};

	return { addRecord, getStats, getRecentRedemptions, getUserStats };
};

export const analytics = useAnalytics();
