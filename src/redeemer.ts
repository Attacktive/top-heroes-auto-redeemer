import axios, { type AxiosResponse, type RawAxiosRequestHeaders } from 'axios';
import { userStore } from './user-store';

const SITE_ID = 1028526 as const;
const PROJECT_ID = 1028637 as const;

const URL_TO_LOGIN: string = 'https://topheroes.store.kopglobal.com/api/v2/store/login/player';
const URL_TO_REDEEM: string = 'https://topheroes.store.kopglobal.com/api/v2/store/redemption/redeem';

interface LoginRequestBody {
	site_id: number;
	player_id: string;
	server_id: string;
	device: string;
}

interface RedeemRequestBody {
	project_id: number;
	redemption_code: string;
}

interface RedeemResponse {
	status?: string;
	message?: string;
	data?: unknown;
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

	const createRedeemBody = (giftCode: string): RedeemRequestBody => ({
		project_id: PROJECT_ID,
		redemption_code: giftCode
	});

	const redeem = async (giftCode: string) => {
		console.log(`🎁 Attempting to redeem gift code: ${giftCode}`);
		console.log(`👥 Target users: ${targetUserIds.join(', ')}`);

		if (targetUserIds.length === 0) {
			console.warn('⚠️  No user IDs configured. Use /add-user command to add users.');
			return [];
		}

		const succeeded: string[] = [];
		for (const userId of targetUserIds) {
			const axiosInstance = createAxiosInstance();

			try {
				console.log(`🔐 Logging in user: ${userId}`);
				const { headers: responseHeaders }: AxiosResponse = await axiosInstance.post(
					URL_TO_LOGIN,
					createLoginBody(userId)
				);

				const authorization: string | undefined = responseHeaders['authorization'];
				console.log('Authorization:', authorization);

				if (!authorization) {
					console.warn(`⚠️  The 'Authorization' header is missing for user ${userId}, skipping`);
					continue;
				}

				console.log(`🎯 Redeeming code for user: ${userId}`);
				const { data: responseData } = await axiosInstance.post<RedeemResponse>(
					URL_TO_REDEEM,
					createRedeemBody(giftCode),
					{
						headers: { 'Authorization': authorization }
					}
				);

				console.log(`✅ Result for user ${userId}:`, responseData);

				/* TODO: the following, for example, is still considered a success:
				 * {
				 *   code: 80006,
				 *   data: null,
				 *   message: 'Maximum limit redemption times reached',
				 *   timestamp: 1759309939
				 * }
				 *
				 * I'll need to which code really is success.
				 */

				succeeded.push(userId);
			} catch (error) {
				console.error(`❌ Error processing user ${userId}:`, error);
			}
		}

		console.log(`🏁 Finished processing gift code: ${giftCode}`);

		return succeeded;
	};

	return { redeem };
};
