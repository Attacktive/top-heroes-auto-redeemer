import axios, { type AxiosResponse, type RawAxiosRequestHeaders } from 'axios';
import { userStore } from './user-store.js';

const SITE_ID = 1028526 as const;
const PROJECT_ID = 1028637 as const;

const URL_TO_LOGIN = 'https://topheroes.store.kopglobal.com/api/v2/store/login/player' as const;
const URL_TO_REDEEM = 'https://topheroes.store.kopglobal.com/api/v2/store/redemption/redeem' as const;
const URL_TO_CHECK_IN = 'https://topheroes.store.kopglobal.com/api/v2/store/sale/biz/sign-in/gift/receive' as const;

interface LoginRequestBody {
	site_id: number;
	player_id: string;
	server_id: string;
	device: string;
}

interface RedemptionRequestBody {
	project_id: number;
	redemption_code: string;
}

interface SignInRequestBody {
	site_id: number;
	activity_id: number;
	sign_in_type: number;
}

interface RedemptionResponse {
	code: number;
	message: string;
	data: string | null;
	timestamp: number;
}

export const useRedeemer = (userIds?: string[]) => {
	const targetUserIds = userIds || userStore.list();
	const loginHeaders: RawAxiosRequestHeaders = {
		accept: 'application/json, text/plain, */*',
		'Content-Type': 'application/json'
	};

	const createAxiosInstance = () => axios.create({ headers: loginHeaders });

	const createLoginBody = (userId: string): LoginRequestBody => ({
		site_id: SITE_ID,
		player_id: userId,
		server_id: '',
		device: 'pc'
	});

	const createRedeemBody = (giftCode: string): RedemptionRequestBody => ({
		project_id: PROJECT_ID,
		redemption_code: giftCode
	});

	const createCheckInBody = (activityId: number): SignInRequestBody => ({
		site_id: SITE_ID,
		activity_id: activityId,
		sign_in_type: 1
	});

	const sleep = (duration = 2222) => new Promise(resolve => setTimeout(resolve, duration));

	const login = async (userId: string) => {
		const axiosInstance = createAxiosInstance();

		console.log(`🔐 Logging in user: ${userId}`);
		const { headers: responseHeaders }: AxiosResponse = await axiosInstance.post(
			URL_TO_LOGIN,
			createLoginBody(userId)
		);

		const authorization: string | undefined = responseHeaders['authorization'];
		if (!authorization) {
			throw new Error(`⚠️  The 'Authorization' header is missing for user ${userId}`);
		}

		axiosInstance.defaults.headers.common['Authorization'] = authorization;

		return axiosInstance;
	};

	const redeem = async (giftCode: string) => {
		console.log(`🎁 Attempting to redeem gift code: ${giftCode}`);
		console.log(`👥 Target users: ${targetUserIds.join(', ')}`);

		if (targetUserIds.length === 0) {
			console.warn('⚠️  No user IDs configured. Use /add-user command to add users.');
			return [];
		}

		const succeeded: string[] = [];
		for (const [index, userId] of targetUserIds.entries()) {
			try {
				const axiosInstance = await login(userId);

				console.log(`🎯 Redeeming code for user: ${userId}`);
				const { headers, data: { data, code, message } } = await axiosInstance.post<RedemptionResponse>(
					URL_TO_REDEEM,
					createRedeemBody(giftCode)
				);

				console.log('headers', headers);

				// or might be code === 1
				if (data === 'success') {
					console.log(`✅ Result for user ${userId}:`, data);
					succeeded.push(userId);
				} else {
					console.error(`❌ Error processing user ${userId}:`, `(${code})`, message);
				}
			} catch (error) {
				console.error(`❌ Error processing user ${userId}; an error is thrown:`, error);
			}

			if (index < targetUserIds.length - 1) {
				await sleep(1111);
			}
		}

		console.log(`🏁 Finished processing gift code: ${giftCode}`);

		return succeeded;
	};

	const checkIn = async (activityId: number) => {
		console.log(`🎁 Attempting to collect check-in rewards for activity ID: ${activityId}`);
		console.log(`👥 Target users: ${targetUserIds.join(', ')}`);

		if (targetUserIds.length === 0) {
			console.warn('⚠️  No user IDs configured. Use /add-user command to add users.');
			return [];
		}

		const succeeded: string[] = [];
		for (const [index, userId] of targetUserIds.entries()) {
			try {
				const axiosInstance = await login(userId);

				console.log(`🎯 Collecting check-in rewards for user: ${userId}`);
				const { data: { data, code, message } } = await axiosInstance.post<RedemptionResponse>(
					URL_TO_CHECK_IN,
					createCheckInBody(activityId)
				);

				// or might be code === 1
				if (data === 'success') {
					console.log(`✅ Result for user ${userId}:`, data);
					succeeded.push(userId);
				} else {
					console.error(`❌ Error processing user ${userId}:`, `(${code})`, message);
				}
			} catch (error) {
				console.error(`❌ Error processing user ${userId}:`, error);
			}

			if (index < targetUserIds.length - 1) {
				await sleep();
			}
		}

		console.log(`🏁 Finished processing activityId: ${activityId}`);

		return succeeded;
	};

	return { redeem, checkIn };
};
