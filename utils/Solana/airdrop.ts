import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "../../config/firebaseconfig";
import { collection, getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

import dotenv from 'dotenv';
dotenv.config();
export const sendAirdrop=async (username:string)=>{

    const usersCollection = collection(db,"users");
    const userDocRef = doc(usersCollection, username);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        const user = userDoc.data();
        const user_public_key=user.publicKey;
        console.log('User public key:', user_public_key);
        const publicKeyObject = new PublicKey(user_public_key);
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const airdropSignature = await connection.requestAirdrop(publicKeyObject, 1000000000); // 1 SOL in lamports
        return airdropSignature;
    }
    else{
        console.log('User not found');
    }



}
