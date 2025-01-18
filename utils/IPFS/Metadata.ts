import { pinata } from "../pinataconfig";
import dotenv from 'dotenv';
dotenv.config();

interface MetadataForm {
    name: string;
    symbol: string;
    description: string;
    image: string; // Add image field to metadata
}

export async function uploadMetadataToIPFS(metadata: MetadataForm) {
  try {
    // Create Blob for metadata
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: "application/json",
    });

    // Convert Blob to File (by providing a name and other file metadata)
    const metadataFile = new File([metadataBlob], `metadata-${metadata.name}.json`, {
      type: "application/json",
      lastModified: Date.now(),
    });

    // Prepare FormData
    const metadataFormData = new FormData();
    metadataFormData.append("file", metadataFile); // Use the File object here

    // Upload metadata to Pinata
    const uploadData = await pinata.upload
      .file(metadataFile) // Pass the File object instead of Blob
      .addMetadata({
        name: metadata.name,
      })
      .group("460ebc1b-216f-4b8f-8d52-51e09b39c5a9");

    // Generate the URL for the uploaded metadata
    const url = `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${uploadData.IpfsHash}`;
    console.log("Metadata URL:", url);

    // Optionally, check the status of the pin job
    const pinjob = await pinata
      .pinJobs()
      .cid(`${uploadData.IpfsHash}`);
    console.log("Pin job status:", pinjob);

    // Return the URL of the uploaded metadata
    return url;

  } catch (e) {
    console.error("Error uploading metadata to IPFS:", e);
    throw new Error("Failed to upload metadata to IPFS");
  }
}
