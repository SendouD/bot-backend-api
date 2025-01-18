import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_SECRET) {
    throw new Error('PRIVY_APP_ID and PRIVY_SECRET must be defined');
}
const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_SECRET);

export default async function createPreWallet(username: string, telegramUserId: string) {
    try {
        console.log('Creating wallet for user:', username);
        const user = await privy.importUser(
            {
                linkedAccounts: [
                    {
                        type: 'telegram',
                        telegramUserId: telegramUserId
                    }],
                createSolanaWallet: true,
                customMetadata: {
                    username: username,
                    isVerified: true
                }
            }
        )
        return user;

    } catch (error) {
        console.error('Error creating wallet:', error);
    }
}