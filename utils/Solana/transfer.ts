import { db } from "../../config/firebaseconfig";
import { collection, doc, getDoc } from "firebase/firestore";
import bs58 from "bs58";
import { encryptPayload } from "../encryptPayload";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import dotenv from 'dotenv';
dotenv.config();
export const Transfer = async (to: string, amount: number, username: string// New parameter for telegram chat link
) => {
  // Fetch user from Firestore
  const usersCollection = collection(db, "users");
  const userDocRef = doc(usersCollection, username);
  const userDoc = await getDoc(userDocRef);
  const redirectLink = `${process.env.REDIRECT_URL}/transactionSignature` || "https://default-redirect-url.com";

  if (userDoc.exists()) {
    const user = userDoc.data();
    const sharedSecret = bs58.decode(user.sharedSecret);
    // Create the Solana transaction
    const sendSolInstructions = SystemProgram.transfer({
      fromPubkey: new PublicKey(user.publicKey),
      toPubkey: new PublicKey(to),
      lamports: amount * LAMPORTS_PER_SOL,
    });

    const transaction = new Transaction().add(sendSolInstructions);
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    transaction.feePayer = new PublicKey(user.publicKey);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({ requireAllSignatures: false ,});

    // Prepare payload
    const payload = {
      session: user.sessionId, // Session ID from Firestore
      transaction: bs58.encode(serializedTransaction), // Base58 encoded transaction
    };

    // Encrypt the payload using shared secret
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    // Construct the deeplink URL
    const deeplinkUrl = new URL("https://phantom.app/ul/v1/signAndSendTransaction");
    deeplinkUrl.searchParams.append("dapp_encryption_public_key", user.dappKeyPair.publicKey); // App's encryption public key
    deeplinkUrl.searchParams.append("nonce", bs58.encode(nonce)); // Base58 encoded nonce
    deeplinkUrl.searchParams.append("redirect_link", redirectLink); // URL-encoded redirect link
    deeplinkUrl.searchParams.append("payload", bs58.encode(encryptedPayload)); // Encrypted payload

    // Return the deeplink URL (to be handled by the parent bot)
    return deeplinkUrl.toString();
  } else {
    console.log("User not found");
    throw new Error("User not found in the system.");
  }
};
