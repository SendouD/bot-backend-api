import TelegramBot from 'node-telegram-bot-api';
import { collection, getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getTokenMetadata, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { db } from '../../config/firebaseconfig';
import dotenv from 'dotenv';
dotenv.config();
const token = process.env.TELEGRAM_BOT_TOKEN;


const bot = new TelegramBot(token!, { webHook: true });

export async function getUserTokens(msg: TelegramBot.Message) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  try {
    if (!msg.from?.id) {
      return;
    }

    const usersCollection = collection(db, "users");
    const userDocRef = doc(usersCollection, msg.from?.username || '');
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const userTokens = userData['Tokens-created'];

      if (userTokens && userTokens.length > 0) {

        // Prepare buttons with token details
        const inlineKeyboard: { text: string; callback_data: string; }[][] = [];

        for (const token of userTokens) {
          const mintPubkey = new PublicKey(token.mintAddress || token);
          const metadata = await getTokenMetadata(
            connection,
            mintPubkey,
            'confirmed',
            TOKEN_2022_PROGRAM_ID
          );

          // Fetch the metadata JSON from the URI
          if (!metadata || !metadata.uri) {
            console.error('Metadata is null or missing URI for token:', token);
            continue;
          }

          const response = await fetch(metadata.uri);
          const metadataJson = await response.json();

          // Get the token name, symbol, and image (logo) URL from the metadata
          const tokenName = metadataJson.name || 'Unnamed Token';
          const tokenSymbol = metadataJson.symbol || 'N/A';
          // Add a button for each token with name, symbol, and logo
          inlineKeyboard.push([
            {
              text: `${tokenName} (${tokenSymbol})`,
              callback_data: `select_token_${token.mintAddress || token}`,
            }
          ]);
        }

        if (inlineKeyboard.length > 0) {
          const keyboard = {
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            }
          };

          // Send message that's only visible to the command sender
          await bot.sendMessage(
            msg.chat.id,
            'Here are your tokens:',
            {
              ...keyboard,
              reply_to_message_id: msg.message_id,
              protect_content: true // Prevents message forwarding
            }
          );
        } else {
          // If no tokens to display
          await bot.sendMessage(
            msg.chat.id,
            'You have not created any tokens yet.',
            {
              reply_to_message_id: msg.message_id,
              protect_content: true
            }
          );
        }
      } else {
        // Send "no tokens" message visible only to sender
        await bot.sendMessage(
          msg.chat.id,
          'You have not created any tokens yet.',
          {
            reply_to_message_id: msg.message_id,
            protect_content: true
          }
        );
      }
    } else {
      await bot.sendMessage(
        msg.chat.id,
        'User data not found.',
        {
          reply_to_message_id: msg.message_id,
          protect_content: true
        }
      );
    }
  } catch (error) {
    console.error('Error retrieving user data:', error);
    await bot.sendMessage(
      msg.chat.id,
      'There was an error retrieving your data.',
      {
        reply_to_message_id: msg.message_id,
        protect_content: true
      }
    );
  }
}
