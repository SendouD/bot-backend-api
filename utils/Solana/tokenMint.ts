import * as web3 from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { db } from "../../config/firebaseconfig";
import { collection, doc, getDoc } from "firebase/firestore";
import bs58 from "bs58";
import { encryptPayload } from "../encryptPayload";
import dotenv from 'dotenv';
dotenv.config();
export async function mintTo(
    mint: web3.PublicKey,
    destination: web3.PublicKey,
    amount: number | bigint,
    username:string,
    multiSigners: web3.Signer[] = [],
    programId = token.TOKEN_2022_PROGRAM_ID
  ): Promise<string> {
    const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
    const usersCollection = collection(db, "users");
    const userDocRef = doc(usersCollection, username);
    const userDoc = await getDoc(userDocRef);
    const redirectLink = `${process.env.REDIRECT_URL}` || "https://default-redirect-url.com";
    function getSigners(
      signerOrMultisig: web3.Signer | web3.PublicKey,
      multiSigners: web3.Signer[]
    ): [web3.PublicKey, web3.Signer[]] {
      return signerOrMultisig instanceof web3.PublicKey
        ? [signerOrMultisig, multiSigners]
        : [signerOrMultisig.publicKey, [signerOrMultisig]];
    }

    if (userDoc.exists()) {
        const user = userDoc.data();
        const sharedSecret = bs58.decode(user.sharedSecret);
        const authority=new web3.PublicKey(user.publicKey);
        console.log(user.publicKey)
  
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    console.log(authorityPublicKey);

  
    const mintToInstruction = token.createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      Number(amount) * web3.LAMPORTS_PER_SOL,
      multiSigners,
      programId
    );
  
    const transaction = new web3.Transaction().add(mintToInstruction);
  
    transaction.feePayer = new web3.PublicKey(user.publicKey);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
  
    if (signers.length > 0) {
      transaction.partialSign(...signers);
    }

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({ requireAllSignatures: false ,});

    // Prepare payload
    const payload = {
      session: user.sessionId, // Session ID from Firestore
      transaction: bs58.encode(serializedTransaction), // Base58 encoded transaction
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

        // Construct the deeplink URL
        const deeplinkUrl = new URL("https://phantom.app/ul/v1/signAndSendTransaction");
        deeplinkUrl.searchParams.append("dapp_encryption_public_key", user.dappKeyPair.publicKey); // App's encryption public key
        deeplinkUrl.searchParams.append("nonce", bs58.encode(nonce)); // Base58 encoded nonce
        deeplinkUrl.searchParams.append("redirect_link", redirectLink); // URL-encoded redirect link
        deeplinkUrl.searchParams.append("payload", bs58.encode(encryptedPayload)); // Encrypted payload
    
        return deeplinkUrl.toString();

}else{

        throw new Error("User document does not exist");
    }
  }