
import { Telegram } from "@privy-io/server-auth";
import { pinata } from "../pinataconfig";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";

import dotenv from 'dotenv';
dotenv.config();


const token = process.env.TELEGRAM_BOT_TOKEN;






const downloadFile = async (fileUrl: string) => {
    try {
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      return response.data;
    } catch (error) {
      console.error('Error downloading file with axios:', error);
      throw error;
    }
  };

export const uploadFiletoIPFS = async (file:TelegramBot.File) => {
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

       const response = await downloadFile(fileUrl);
                          console.log(response);
                          const buffer = Buffer.from(response);  // Convert arrayBuffer to Buffer
      
                          // Create a FileObject to upload to Pinata
                          let fileObject;
                          if (file.file_path) {
                            fileObject = new File([buffer], file.file_path, { type: 'image/jpeg' }); // Adjust type based on the image format
                          } else {
                            throw new Error('File path is undefined');
                          }
      
                          // Upload to Pinata
                          const uploadData = await pinata.upload
                            .file(fileObject)  // Upload FileObject
                            .addMetadata({
                              name: file.file_path,    
                            })
                            .group("460ebc1b-216f-4b8f-8d52-51e09b39c5a9");
      
                            let correctedFilePath = file.file_path.split('/').pop(); // Get the file name (last part of the path)
                            if (correctedFilePath) {
                              correctedFilePath = correctedFilePath.includes('.jpg') ? correctedFilePath : `${correctedFilePath}.jpg`;
                            } else {
                              throw new Error('File path is undefined');
                            }
                            
                            const url = `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${uploadData.IpfsHash}/${correctedFilePath}`;
                            
                          console.log(url);
      
                          const pinjob = await pinata
                            .pinJobs()
                            .cid(`${uploadData.IpfsHash}`);
                            return url; 
}