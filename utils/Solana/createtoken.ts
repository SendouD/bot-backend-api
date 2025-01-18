

import * as web3 from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { db } from "../../config/firebaseconfig";
import { collection, doc, getDoc } from "firebase/firestore";
import bs58 from "bs58";

import { TokenMetadata, pack } from "@solana/spl-token-metadata";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createInitializeMintInstruction } from "@solana/spl-token";
import { encryptPayload } from "../encryptPayload";
import dotenv from 'dotenv';
dotenv.config();
const decimal = 9; // You can change this based on your token's needs




const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');


const TOKEN_2022_PROGRAM_ID = token.TOKEN_2022_PROGRAM_ID;

interface MetadataForm {
    name: string;
    symbol: string;
    description: string;
}


export async function createMint(
    { name, symbol, description }: MetadataForm,
    uri: string | null,
    username: string,

    confirmOptions?: web3.ConfirmOptions,
): Promise<{ transactionURL: string; mintAddress: string; }> {
    const usersCollection = collection(db, "users");
    const userDocRef = doc(usersCollection, username);
    const userDoc = await getDoc(userDocRef);
    const redirectLink = `${process.env.REDIRECT_URL}/tokenMint` || "https://default-redirect-url.com";

    if (userDoc.exists()) {
        const user = userDoc.data();
        const sharedSecret = bs58.decode(user.sharedSecret);
        // Create the Solana transaction

        const mintKeypair = web3.Keypair.generate();

        const metadata: TokenMetadata = {
            name,
            symbol,
            uri: uri || "",
            mint: mintKeypair.publicKey,
            additionalMetadata: [
                ['description', description],
            ],
        };



        try {
            // Generate a new keypair for the mint account

            // Get minimum lamports needed for rent exemption
            const mintSpace = token.getMintLen([token.ExtensionType.MetadataPointer]);
            const metadataLen = token.TYPE_SIZE + token.LENGTH_SIZE + pack(metadata).length;
            const lamports = await connection.getMinimumBalanceForRentExemption(
                mintSpace + metadataLen
            );
            console.log('user public key',user.publicKey);
            const createAccountIx = web3.SystemProgram.createAccount({
                fromPubkey: new web3.PublicKey(user.publicKey),
                newAccountPubkey: mintKeypair.publicKey,
                space: mintSpace,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            })
            const initializeMetadataPointerIx = token.createInitializeMetadataPointerInstruction(
                mintKeypair.publicKey,
                new web3.PublicKey(user.publicKey),
                mintKeypair.publicKey,
                TOKEN_2022_PROGRAM_ID
            )
            // Initialize mint instruction
            const initializeMintIx = createInitializeMintInstruction(
                mintKeypair.publicKey,
                decimal,
                new web3.PublicKey(user.publicKey),
                new web3.PublicKey(user.publicKey),
                TOKEN_2022_PROGRAM_ID
            );
            const initializeMetadataIx = token.createInitializeInstruction({
                mint: mintKeypair.publicKey,
                metadata: mintKeypair.publicKey,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: new web3.PublicKey(user.publicKey),
                updateAuthority: new web3.PublicKey(user.publicKey),
                programId: TOKEN_2022_PROGRAM_ID,

            })
            const updateMetadataIx = token.createUpdateFieldInstruction({
                metadata: mintKeypair.publicKey,
                updateAuthority: new web3.PublicKey(user.publicKey),
                field: metadata.additionalMetadata[0][0],
                value: metadata.additionalMetadata[0][1],
                programId: TOKEN_2022_PROGRAM_ID
            })



            // Create transaction for token creation
            const transaction = new web3.Transaction().add(
                createAccountIx,
                initializeMetadataPointerIx,
                initializeMintIx,
                initializeMetadataIx,
                updateMetadataIx
            );
            transaction.feePayer = new web3.PublicKey(user.publicKey);
            transaction.recentBlockhash = (
                await connection.getLatestBlockhash()
            ).blockhash;
            transaction.partialSign(mintKeypair);
            const serializedTransaction = transaction.serialize({ requireAllSignatures: false, });
            const payload = {
                session: user.sessionId, // Session ID from Firestore
                transaction: bs58.encode(serializedTransaction), // Base58 encoded transaction
            };
            const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);
            const deeplinkUrl = new URL("https://phantom.app/ul/v1/signAndSendTransaction");
            deeplinkUrl.searchParams.append("dapp_encryption_public_key", user.dappKeyPair.publicKey); // App's encryption public key
            deeplinkUrl.searchParams.append("nonce", bs58.encode(nonce)); // Base58 encoded nonce
            deeplinkUrl.searchParams.append("redirect_link", redirectLink); // URL-encoded redirect link
            deeplinkUrl.searchParams.append("payload", bs58.encode(encryptedPayload)); // Encrypted payload



            // // Confirm transaction  
            // const tokenAccount = await getOrCreateAssociatedTokenAccount( mintKeypair.publicKey, wallet, wallet.publicKey);
            // alert(`Token Account created! address: ${tokenAccount.address.toString()}`);

            const transactionURL=deeplinkUrl.toString();
            const mintAddress = mintKeypair.publicKey.toBase58();
            return {
                transactionURL,
                mintAddress
            };

        } catch (error) {
            console.error('Error creating token:', error);
            return {
                transactionURL: "",
                mintAddress: ""
            };
        }
    }
    else {
        console.log("User not found");
        throw new Error("User not found in the system.");
    }
}